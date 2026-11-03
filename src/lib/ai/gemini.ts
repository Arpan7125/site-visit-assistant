import type Anthropic from "@anthropic-ai/sdk";
import { ApiError, GoogleGenAI, ThinkingLevel, type Content, type FunctionDeclaration, type Part } from "@google/genai";
import type { ModelProvider, ModelRequest, ModelResponse } from "./provider";

/**
 * Gemini adapter. The agent speaks one message format (Anthropic's content blocks); this file
 * translates it to Gemini contents and back, so the agent, tools and guard stay provider-neutral.
 *
 * Gemini thinking models attach `thoughtSignature`s to parts and need them back unchanged on the
 * next round of a tool loop. We keep the model's raw parts on the first returned block and replay
 * them verbatim instead of rebuilding them.
 */

type WithRaw = { _geminiParts?: Part[] };

export function toGeminiTools(tools: Anthropic.Tool[]): FunctionDeclaration[] {
  return tools.map((t) => ({ name: t.name, description: t.description, parametersJsonSchema: t.input_schema }));
}

export function toGeminiContents(messages: Anthropic.MessageParam[]): Content[] {
  const toolNames = new Map<string, string>();
  const out: Content[] = [];
  for (const m of messages) {
    const role = m.role === "assistant" ? "model" : "user";
    if (typeof m.content === "string") {
      out.push({ role, parts: [{ text: m.content }] });
      continue;
    }
    const blocks = m.content as (Anthropic.ContentBlockParam & WithRaw)[];
    for (const b of blocks) if (b.type === "tool_use") toolNames.set(b.id, b.name);
    const raw = blocks[0]?._geminiParts;
    if (role === "model" && raw) {
      out.push({ role, parts: raw });
      continue;
    }
    const parts: Part[] = [];
    for (const b of blocks) {
      if (b.type === "text") parts.push({ text: b.text });
      else if (b.type === "tool_use") parts.push({ functionCall: { id: b.id, name: b.name, args: b.input as Record<string, unknown> } });
      else if (b.type === "tool_result") {
        const text = typeof b.content === "string" ? b.content : JSON.stringify(b.content ?? null);
        let value: unknown;
        try {
          value = JSON.parse(text);
        } catch {
          value = text;
        }
        parts.push({
          functionResponse: {
            id: b.tool_use_id,
            name: toolNames.get(b.tool_use_id) ?? "unknown",
            response: b.is_error ? { error: value } : { output: value },
          },
        });
      }
    }
    if (parts.length) out.push({ role, parts });
  }
  return out;
}

let seq = 0;

/** Gemini parts → the agent's content blocks. Thought parts are dropped from the visible reply. */
export function fromGeminiParts(parts: Part[], finishReason: string | undefined): ModelResponse {
  const content: (Anthropic.ContentBlock & WithRaw)[] = [];
  for (const p of parts) {
    if (p.functionCall?.name) {
      content.push({
        type: "tool_use",
        id: p.functionCall.id || `gem_${Date.now().toString(36)}_${++seq}`,
        name: p.functionCall.name,
        input: p.functionCall.args ?? {},
        caller: { type: "direct" },
      } as Anthropic.ToolUseBlock);
    } else if (p.text && !p.thought) {
      content.push({ type: "text", text: p.text, citations: null } as Anthropic.TextBlock);
    }
  }
  if (content.length) content[0]._geminiParts = parts;
  const blocked = ["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION"].includes(finishReason ?? "");
  const stop_reason: Anthropic.Message["stop_reason"] = blocked
    ? "refusal"
    : content.some((c) => c.type === "tool_use")
      ? "tool_use"
      : finishReason === "MAX_TOKENS"
        ? "max_tokens"
        : "end_turn";
  return { content, stop_reason };
}

/** Capacity or rate problems on Google's side: worth trying another model, not worth waiting. */
export function isCapacityError(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 429 || err.status >= 500);
}

export class GeminiProvider implements ModelProvider {
  readonly name: string;
  private client: GoogleGenAI;
  private models: string[];

  constructor(
    apiKey: string,
    model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
    // Stable models tried in order when the primary is overloaded (503 "high demand", seen live).
    fallbacks = (process.env.GEMINI_FALLBACK_MODELS ?? "gemini-3.1-flash-lite,gemini-3.6-flash").split(",").map((m) => m.trim()).filter(Boolean),
    private thinking = (process.env.GEMINI_THINKING || "LOW").toUpperCase(),
  ) {
    this.models = [model, ...fallbacks.filter((m) => m !== model)];
    this.name = `gemini:${model}`;
    this.client = new GoogleGenAI({ apiKey });
  }

  async create(req: ModelRequest, opts: { signal: AbortSignal; timeoutMs: number }): Promise<ModelResponse> {
    const contents = toGeminiContents(req.messages);
    const level = (ThinkingLevel as Record<string, ThinkingLevel>)[this.thinking];
    let lastError: unknown;
    for (const model of this.models) {
      try {
        const res = await this.client.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: req.system,
            tools: [{ functionDeclarations: toGeminiTools(req.tools) }],
            maxOutputTokens: req.maxTokens ?? 4096,
            // The chat deadline is enforced by the abort signal. Gemini rejects server deadlines
            // under 10 s, so no httpOptions.timeout is sent; the SDK does not retry by itself.
            abortSignal: opts.signal,
            ...(level ? { thinkingConfig: { thinkingLevel: level } } : {}),
          },
        });
        const candidate = res.candidates?.[0];
        return fromGeminiParts(candidate?.content?.parts ?? [], candidate?.finishReason);
      } catch (err) {
        if (!isCapacityError(err) || opts.signal.aborted) throw err;
        console.warn(`gemini ${model} unavailable (${(err as ApiError).status}); trying next model`);
        lastError = err;
      }
    }
    throw lastError;
  }
}

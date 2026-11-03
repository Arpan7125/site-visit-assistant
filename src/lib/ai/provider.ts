import Anthropic from "@anthropic-ai/sdk";
import { GeminiProvider } from "./gemini";

export type ModelRequest = {
  system: string;
  messages: Anthropic.MessageParam[];
  tools: Anthropic.Tool[];
  maxTokens?: number;
};

export type ModelResponse = Pick<Anthropic.Message, "content" | "stop_reason">;

/** The only seam between the app and an LLM. Tests inject a fake; production uses Anthropic. */
export interface ModelProvider {
  readonly name: string;
  create(req: ModelRequest, opts: { signal: AbortSignal; timeoutMs: number }): Promise<ModelResponse>;
}

export class AnthropicProvider implements ModelProvider {
  readonly name: string;
  private client: Anthropic;

  constructor(
    private model = process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
    private effort = (process.env.ANTHROPIC_EFFORT || "low") as "low" | "medium" | "high",
  ) {
    this.name = `anthropic:${model}`;
    // No SDK retries: the chat has a hard 8 s budget and falls back to a person instead.
    this.client = new Anthropic({ maxRetries: 0 });
  }

  async create(req: ModelRequest, opts: { signal: AbortSignal; timeoutMs: number }): Promise<ModelResponse> {
    const res = await this.client.messages.create(
      {
        model: this.model,
        max_tokens: req.maxTokens ?? 4096,
        system: req.system,
        messages: req.messages,
        tools: req.tools,
        tool_choice: { type: "auto" },
        output_config: { effort: this.effort },
      },
      { signal: opts.signal, timeout: opts.timeoutMs },
    );
    return { content: res.content, stop_reason: res.stop_reason };
  }
}

/** Used when no API key is configured: every turn takes the outage path, honestly. */
export class UnavailableProvider implements ModelProvider {
  readonly name = "unavailable";
  async create(): Promise<ModelResponse> {
    throw new Error("No ANTHROPIC_API_KEY configured");
  }
}

/**
 * AI_PROVIDER picks the model vendor ("anthropic" or "gemini"). Without it, whichever key is
 * present is used, Anthropic first. No key at all → honest outage path.
 */
export function selectProvider(env: Record<string, string | undefined>): "anthropic" | "gemini" | "none" {
  const want = env.AI_PROVIDER?.toLowerCase();
  if (want === "gemini") return env.GEMINI_API_KEY ? "gemini" : "none";
  if (want === "anthropic") return env.ANTHROPIC_API_KEY ? "anthropic" : "none";
  if (env.ANTHROPIC_API_KEY) return "anthropic";
  if (env.GEMINI_API_KEY) return "gemini";
  return "none";
}

let cached: ModelProvider | null = null;
export function defaultProvider(): ModelProvider {
  if (!cached) {
    const which = selectProvider(process.env);
    cached =
      which === "anthropic"
        ? new AnthropicProvider()
        : which === "gemini"
          ? new GeminiProvider(process.env.GEMINI_API_KEY!)
          : new UnavailableProvider();
  }
  return cached;
}

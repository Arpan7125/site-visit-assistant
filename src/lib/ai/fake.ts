import type Anthropic from "@anthropic-ai/sdk";
import type { ModelProvider, ModelRequest, ModelResponse } from "./provider";

/**
 * Scripted model for tests and evals. Each step sees the request (so it can read tool results)
 * and returns a response. Steps run in order; running out of steps is a test failure.
 */
export type FakeStep = (req: ModelRequest) => ModelResponse | Promise<ModelResponse>;

export class FakeProvider implements ModelProvider {
  readonly name = "fake";
  readonly requests: ModelRequest[] = [];
  private i = 0;
  constructor(private steps: FakeStep[]) {}

  async create(req: ModelRequest, opts: { signal: AbortSignal }): Promise<ModelResponse> {
    this.requests.push(structuredClone({ ...req, tools: [] }));
    const step = this.steps[this.i++];
    if (!step) throw new Error("FakeProvider: no more scripted steps");
    if (opts.signal.aborted) throw new Error("aborted");
    return step(req);
  }
}

export function say(text: string): FakeStep {
  return () => ({ stop_reason: "end_turn", content: [{ type: "text", text, citations: null } as Anthropic.TextBlock] });
}

let callSeq = 0;
export function call(name: string, input: Record<string, unknown>, text = ""): FakeStep {
  return () => ({
    stop_reason: "tool_use",
    content: [
      ...(text ? [{ type: "text", text, citations: null } as Anthropic.TextBlock] : []),
      { type: "tool_use", id: `toolu_fake_${++callSeq}`, name, input } as Anthropic.ToolUseBlock,
    ],
  });
}

/** Step whose reply depends on the last tool result (e.g. pick the first slot returned). */
export function callWith(name: string, build: (lastResult: unknown) => Record<string, unknown>): FakeStep {
  return (req) => {
    const last = req.messages[req.messages.length - 1];
    const block = Array.isArray(last.content) ? last.content.find((b) => b.type === "tool_result") : undefined;
    const raw = block && block.type === "tool_result" && typeof block.content === "string" ? JSON.parse(block.content) : null;
    return call(name, build(raw))(req);
  };
}

export function hang(ms: number): FakeStep {
  return () => new Promise((resolve) => setTimeout(() => resolve({ stop_reason: "end_turn", content: [] }), ms));
}

export function fail(message = "529 overloaded"): FakeStep {
  return () => {
    throw new Error(message);
  };
}

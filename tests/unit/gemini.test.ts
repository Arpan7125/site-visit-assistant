import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { fromGeminiParts, toGeminiContents, toGeminiTools } from "@/lib/ai/gemini";
import { selectProvider } from "@/lib/ai/provider";
import { TOOLS } from "@/lib/ai/tools";

describe("Gemini adapter", () => {
  it("passes every tool's JSON schema through unchanged", () => {
    const decls = toGeminiTools(TOOLS);
    expect(decls.map((d) => d.name)).toEqual(TOOLS.map((t) => t.name));
    expect(decls[0].parametersJsonSchema).toBe(TOOLS[0].input_schema);
  });

  it("maps a tool round trip, naming each function response after its call", () => {
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: "Is there parking?" },
      { role: "assistant", content: [{ type: "tool_use", id: "c1", name: "search_fact_sheet", input: { query: "parking" } }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "c1", content: '{"entries":[]}', is_error: false }] },
    ];
    expect(toGeminiContents(messages)).toEqual([
      { role: "user", parts: [{ text: "Is there parking?" }] },
      { role: "model", parts: [{ functionCall: { id: "c1", name: "search_fact_sheet", args: { query: "parking" } } }] },
      { role: "user", parts: [{ functionResponse: { id: "c1", name: "search_fact_sheet", response: { output: { entries: [] } } } }] },
    ]);
  });

  it("wraps tool errors so the model can tell them apart", () => {
    const contents = toGeminiContents([
      { role: "assistant", content: [{ type: "tool_use", id: "c2", name: "book_visit", input: {} }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "c2", content: '{"error":"SLOT_TAKEN"}', is_error: true }] },
    ]);
    expect(contents[1].parts?.[0].functionResponse?.response).toEqual({ error: { error: "SLOT_TAKEN" } });
  });

  it("replays the model's raw parts (thought signatures) verbatim on the next round", () => {
    const raw = [
      { thought: true, text: "thinking", thoughtSignature: "sig-A" },
      { functionCall: { id: "g1", name: "get_free_slots", args: { project_id: "aranya" } }, thoughtSignature: "sig-B" },
    ];
    const res = fromGeminiParts(raw, "STOP");
    expect(res.stop_reason).toBe("tool_use");
    expect(res.content).toHaveLength(1); // the thought is not shown
    const replay = toGeminiContents([{ role: "assistant", content: res.content as Anthropic.ContentBlockParam[] }]);
    expect(replay[0]).toEqual({ role: "model", parts: raw });
  });

  it("gives tool calls without an id a unique one, and maps finish reasons", () => {
    const a = fromGeminiParts([{ functionCall: { name: "search_fact_sheet", args: {} } }], "STOP");
    const b = fromGeminiParts([{ functionCall: { name: "search_fact_sheet", args: {} } }], "STOP");
    const idOf = (r: typeof a) => (r.content[0] as Anthropic.ToolUseBlock).id;
    expect(idOf(a)).not.toBe(idOf(b));
    expect(fromGeminiParts([{ text: "Hello" }], "STOP")).toMatchObject({ stop_reason: "end_turn" });
    expect(fromGeminiParts([], "SAFETY").stop_reason).toBe("refusal");
    expect(fromGeminiParts([{ text: "cut" }], "MAX_TOKENS").stop_reason).toBe("max_tokens");
  });
});

describe("selectProvider", () => {
  it("honours AI_PROVIDER, otherwise prefers whichever key exists", () => {
    expect(selectProvider({ AI_PROVIDER: "gemini", GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a" })).toBe("gemini");
    expect(selectProvider({ AI_PROVIDER: "gemini" })).toBe("none");
    expect(selectProvider({ GEMINI_API_KEY: "g" })).toBe("gemini");
    expect(selectProvider({ ANTHROPIC_API_KEY: "a", GEMINI_API_KEY: "g" })).toBe("anthropic");
    expect(selectProvider({})).toBe("none");
  });
});

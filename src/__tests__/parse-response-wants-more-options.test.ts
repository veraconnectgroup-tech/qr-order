import { describe, expect, it } from "vitest";
import { parseAiStructuredResponse } from "@/lib/ai/parse-response";

const BASE_RESPONSE = {
  intent: "chat",
  recommendations: [],
  proposedItems: [],
  quickReplies: [],
  submitOrder: false,
  message: "Evo menija!",
};

describe("parseAiStructuredResponse — wantsMoreOptions (2026-07-12 regex purge)", () => {
  it("parses wantsMoreOptions:true from the LLM's own structured output", () => {
    const { structured } = parseAiStructuredResponse(
      JSON.stringify({ ...BASE_RESPONSE, wantsMoreOptions: true }),
      {}
    );
    expect(structured.wantsMoreOptions).toBe(true);
  });

  it("defaults wantsMoreOptions to false when the model omits it", () => {
    const { structured } = parseAiStructuredResponse(
      JSON.stringify(BASE_RESPONSE),
      {}
    );
    expect(structured.wantsMoreOptions).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { legacyTokensForAiSession } from "@/lib/ai/guest-ai-token";

describe("legacyTokensForAiSession", () => {
  it("returns session token only for the same table", () => {
    expect(
      legacyTokensForAiSession("table-a", "sess-1", "table-a")
    ).toEqual(["sess-1"]);
  });

  it("blocks cross-table session reuse", () => {
    expect(
      legacyTokensForAiSession("table-b", "sess-from-a", "table-a")
    ).toEqual([]);
  });

  it("allows legacy lookup when guest table is not hydrated yet", () => {
    expect(legacyTokensForAiSession("table-a", "sess-1", null)).toEqual([
      "sess-1",
    ]);
  });
});

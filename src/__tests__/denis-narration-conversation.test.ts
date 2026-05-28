import { describe, expect, it } from "vitest";
import {
  hasCommittedNarrationFacts,
  shouldKeepLegacyConversationReply,
} from "@/lib/denis/runtime/narrate/has-committed-narration-facts";
import type { NarrationFacts } from "@/lib/denis/runtime/narrate/narration-facts.schema";

const baseFacts: NarrationFacts = {
  persona: { name: "Denis", tone: "warm_short", maxWords: 45 },
  language: "sr",
  goal: "OPEN_TABLE",
  committed: {},
  forbidden: [],
  allowedMentions: [],
};

describe("hasCommittedNarrationFacts", () => {
  it("is false for empty chat turns", () => {
    expect(hasCommittedNarrationFacts(baseFacts)).toBe(false);
  });

  it("is true when cart facts exist", () => {
    expect(
      hasCommittedNarrationFacts({
        ...baseFacts,
        committed: { addedItems: ["Pilsner 0,3L"] },
      })
    ).toBe(true);
  });
});

describe("shouldKeepLegacyConversationReply", () => {
  it("keeps legacy reply for pure conversation", () => {
    expect(
      shouldKeepLegacyConversationReply(
        baseFacts,
        "Razumem — već ste za stolom. Šta želite da naručite?"
      )
    ).toBe(true);
  });

  it("does not keep legacy when order facts committed", () => {
    expect(
      shouldKeepLegacyConversationReply(
        {
          ...baseFacts,
          committed: { cartSummary: "Pilsner 0,3L" },
        },
        "Dodato u korpu."
      )
    ).toBe(false);
  });
});

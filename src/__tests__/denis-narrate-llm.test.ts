import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { buildNarrateLlmMessages } from "@/lib/denis/runtime/narrate/narrate-llm";
import { shouldUseDenisNarration } from "@/lib/denis/runtime/narrate/should-use-denis-narration";
import type { NarrationFacts } from "@/lib/denis/runtime/narrate/narration-facts.schema";

const sampleFacts: NarrationFacts = {
  persona: { name: "Denis", tone: "warm_short", maxWords: 45 },
  language: "de",
  goal: "COMPLETE_ROUND",
  committed: { cartSummary: "Cola ×2" },
  forbidden: ["As an AI"],
  allowedMentions: ["Cola"],
};

describe("Denis M21 narrate-llm", () => {
  it("narrateWithLlm on by default — denis_only rollout gets the real narrator", () => {
    expect(CONCIERGE_PLATFORM_DEFAULTS.llm.narrateWithLlm).toBe(true);
    expect(
      shouldUseDenisNarration(CONCIERGE_PLATFORM_DEFAULTS, "denis_only")
    ).toBe(true);
  });

  it("enables Denis narrator only for denis_only + flag", () => {
    const config = {
      ...CONCIERGE_PLATFORM_DEFAULTS,
      llm: {
        ...CONCIERGE_PLATFORM_DEFAULTS.llm,
        narrateWithLlm: true,
      },
    };
    expect(shouldUseDenisNarration(config, "denis_only")).toBe(true);
    expect(shouldUseDenisNarration(config, "canary")).toBe(true);
    expect(
      shouldUseDenisNarration(config, "canary", { guestUsesLegacy: true })
    ).toBe(false);
    expect(shouldUseDenisNarration(config, "shadow")).toBe(false);
  });

  it("builds facts-only narrator prompt", () => {
    const messages = buildNarrateLlmMessages(sampleFacts);
    expect(messages[0]?.role).toBe("system");
    expect(messages[0]?.content).toContain("committed facts");
    expect(messages[0]?.content).not.toContain("proposedItems");
    const userBody = messages[1]?.content ?? "";
    expect(userBody).toContain("Cola");
    expect(userBody).not.toContain("submit");
  });
});

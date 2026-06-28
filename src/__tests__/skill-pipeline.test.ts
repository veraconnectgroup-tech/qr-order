import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { runSkillPipelineFixture } from "@/lib/denis/eval/run-skill-pipeline-fixture";
import { planTurnWithReflex } from "@/lib/denis/kernel/reflex-plan";
import {
  runPostSkillPipeline,
  runPreSkillPipeline,
} from "@/lib/denis/kernel/skill-pipeline";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";

describe("skill-pipeline", () => {
  it("allergy mentioned → pre.allergy_guard injects context", () => {
    const result = runPreSkillPipeline({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      guestMessage: "bez glutena",
      language: "sr",
      allergyLabels: ["gluten", "nuts"],
    });
    expect(result.fired.some((row) => row.id === "pre.allergy_guard")).toBe(true);
    expect(result.promptBlocks.join("\n")).toContain("gluten");
  });

  it("wrong LLM price → post.price_check corrects", () => {
    const result = runPostSkillPipeline({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      structured: {
        intent: "menu_info",
        message: "Weizen is 50.00 EUR",
        recommendations: [],
        proposedItems: [],
        quickReplies: [],
        submitOrder: false,
      },
      language: "de",
      guestMessage: "preis?",
      productMap: {
        w1: { id: "w1", name: "Weizen", price: 5.5 },
      },
      currency: "EUR",
    });
    expect(result.fired.some((row) => row.id === "post.price_check")).toBe(true);
    expect(result.structured.message).toContain("5.50 EUR");
  });

  it("forbidden phrase → post.tone_guard removes", () => {
    const result = runPostSkillPipeline({
      config: {
        ...CONCIERGE_PLATFORM_DEFAULTS,
        persona: {
          ...CONCIERGE_PLATFORM_DEFAULTS.persona,
          forbiddenPhrases: ["samo digitalni konobar"],
        },
      },
      structured: {
        intent: "chat",
        message: "Ja sam samo digitalni konobar.",
        recommendations: [],
        proposedItems: [],
        quickReplies: [],
        submitOrder: false,
      },
      language: "sr",
      guestMessage: "zdravo",
    });
    expect(result.fired.some((row) => row.id === "post.tone_guard")).toBe(true);
    expect(result.structured.message.toLowerCase()).not.toContain(
      "digitalni konobar"
    );
  });

  it("reflex feeds pipeline hints without replacing LLM path", () => {
    const reflex = planTurnWithReflex({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      message: "da",
      flowNodeId: "recap",
      cartState: emptyCartState(),
    });
    expect(reflex.pipelineHints.feedsPipeline).toBe(true);
    expect(reflex.pipelineHints.reflexIntent).toBe("CONFIRM");
    expect(reflex.usedT0).toBe(true);
  });

  it("pipeline transparency eval passes", () => {
    const report = runSkillPipelineFixture();
    expect(report.ok).toBe(true);
    expect(report.errors).toEqual([]);
  });
});

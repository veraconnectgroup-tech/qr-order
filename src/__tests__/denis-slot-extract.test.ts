import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { heuristicSlotExtract } from "@/lib/denis/runtime/perceive/heuristic-slot-extract";
import { shouldRunSlotExtract } from "@/lib/denis/runtime/perceive/should-run-slot-extract";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { planTurnWithReflex } from "@/lib/denis/kernel/reflex-plan";

describe("Denis M22 slot extract", () => {
  it("parses numeric and word quantities", () => {
    const slots = heuristicSlotExtract("2x cola zero i jedan burger");
    expect(slots.items.length).toBeGreaterThanOrEqual(2);
    expect(slots.items[0]?.quantity).toBe(2);
    expect(slots.tier).toBe("T0_heuristic");
  });

  it("parses German multi-item utterance", () => {
    const slots = heuristicSlotExtract("zwei pils und ein schnitzel");
    expect(slots.items).toHaveLength(2);
    expect(slots.items[0]?.productNameRaw).toMatch(/pils/i);
  });

  it("skips slot extract on T0 confirm", () => {
    const reflex = planTurnWithReflex({
      config: {
        ...CONCIERGE_PLATFORM_DEFAULTS,
        ordering: {
          ...CONCIERGE_PLATFORM_DEFAULTS.ordering,
          slotExtractEnabled: true,
        },
      },
      message: "da",
      flowNodeId: "recap",
      cartState: emptyCartState(),
    });
    expect(reflex.usedT0).toBe(true);
    expect(shouldRunSlotExtract(CONCIERGE_PLATFORM_DEFAULTS, reflex)).toBe(
      false
    );
  });

  it("slot extract on by default, LLM slot extraction stays off", () => {
    expect(CONCIERGE_PLATFORM_DEFAULTS.ordering.slotExtractEnabled).toBe(
      true
    );
    expect(CONCIERGE_PLATFORM_DEFAULTS.llm.slotExtractWithLlm).toBe(false);
  });
});

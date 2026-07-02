import { describe, expect, it } from "vitest";
import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { derivePriceCeilingEur } from "@/lib/denis/cognition/mental-model/derive-price-ceiling";
import { derivePriceAffinity } from "@/lib/denis/cognition/mental-model/derive-price-affinity";
import { deriveScrollPosture } from "@/lib/denis/cognition/mental-model/derive-scroll-posture";
import { derivePace } from "@/lib/denis/cognition/mental-model/derive-pace";
import { deriveIntent } from "@/lib/denis/cognition/mental-model/derive-intent";
import { emptyConversationModel } from "@/lib/denis/cognition/conversation/empty-conversation-model";
import { foldGuestMentalModel } from "@/lib/denis/cognition/mental-model/fold-guest-mental-model";
import {
  filterProactiveCandidatesByMentalModel,
  formatGuestMentalModelBlock,
} from "@/lib/denis/cognition/mental-model/mental-model-intelligence";
import {
  deriveFusionStyle,
  synthesizePredictedNeed,
} from "@/lib/denis/cognition/mental-model/synthesize-predicted-need";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import type { GuestSignalSpine } from "@/lib/denis/cognition/mental-model/guest-signal-types";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import type { GuestProactiveNudgeKind } from "@/lib/denis/cognition/proactive/proactive-types";

const NOW = Date.parse("2026-06-07T20:00:00.000Z");

const EMPTY_SPINE: GuestSignalSpine = {
  guestMessages: [],
  declineSignals: [],
  browseChurn: [],
  maxProductCartChurn: 0,
  proactivePairs: [],
  emittedProactiveKeys: [],
  recommendationAsked: false,
  guestInitiatedBeforeDenis: false,
  actionTimestamps: [],
};

function browseWithScroll(
  intent: "fast_search" | "slow_category" | "reached_bottom",
  categoryLabel?: string
) {
  return {
    ...emptyBrowseProfile(),
    eventCount: 2,
    totalBrowseMs: intent === "slow_category" ? 10_000 : 2_000,
    scrollIntents: [
      {
        intent,
        categoryLabel,
        at: "2026-06-07T19:58:00.000Z",
      },
    ],
    viewedProducts: [
      {
        productId: "p1",
        productName: "Soup",
        categoryPath: ["food"],
        viewCount: 1,
        totalDwellMs: 3_000,
        addedToCart: false,
        removedFromCart: false,
        disposition: "viewed" as const,
        unitPrice: 8,
        lastViewedAt: "2026-06-07T19:58:00.000Z",
      },
      {
        productId: "p2",
        productName: "Salad",
        categoryPath: ["food"],
        viewCount: 1,
        totalDwellMs: 2_500,
        addedToCart: false,
        removedFromCart: false,
        disposition: "viewed" as const,
        unitPrice: 9,
        lastViewedAt: "2026-06-07T19:59:00.000Z",
      },
    ],
    priceBrowseStats: {
      viewedPriceCount: 2,
      avgViewedPrice: 8.5,
      maxViewedPrice: 9,
      onlyBudgetItems: true,
      onlyPremiumItems: false,
    },
  };
}

describe("deriveScrollPosture", () => {
  it("maps fast_search to searching posture", () => {
    const posture = deriveScrollPosture(browseWithScroll("fast_search"));
    expect(posture.searching).toBe(true);
    expect(posture.deferUpsell).toBe(false);
    expect(posture.readyForRecommendation).toBe(false);
  });

  it("maps slow_category to defer upsell", () => {
    const posture = deriveScrollPosture(
      browseWithScroll("slow_category", "Burgeri")
    );
    expect(posture.deferUpsell).toBe(true);
    expect(posture.focusedCategory).toBe("Burgeri");
  });

  it("maps reached_bottom to recommendation moment", () => {
    const posture = deriveScrollPosture(browseWithScroll("reached_bottom"));
    expect(posture.readyForRecommendation).toBe(true);
  });
});

describe("scroll → pace and intent", () => {
  it("fast_search elevates pace to rushed and intent to comparing", () => {
    const browse = browseWithScroll("fast_search");
    const scrollPosture = deriveScrollPosture(browse);

    expect(
      derivePace({
        spine: EMPTY_SPINE,
        browse,
        scrollPosture,
      })
    ).toBe("rushed");

    expect(
      deriveIntent({
        phase: "browsing",
        flowNodeId: "collect",
        orders: [],
        cartLineCount: 0,
        browse,
        conversation: emptyConversationModel(),
        billSettled: false,
        scrollPosture,
      })
    ).toBe("comparing");
  });
});

describe("price ceiling from browse", () => {
  it("caps recommendations when guest only views budget items", () => {
    const browse = browseWithScroll("fast_search");
    const affinity = derivePriceAffinity(browse);
    expect(affinity).toBe("budget");
    expect(
      derivePriceCeilingEur({ browse, priceAffinity: affinity })
    ).toBe(12);
  });
});

describe("scroll fusion and predicted need", () => {
  it("slow_category defers predicted need while exploring", () => {
    const scrollPosture = deriveScrollPosture(
      browseWithScroll("slow_category", "Pizza")
    );

    expect(
      synthesizePredictedNeed({
        intent: "exploring",
        mealStage: "pre_order",
        receptiveness: "open",
        pace: "relaxed",
        scrollPosture,
      })
    ).toBe("none");

    expect(
      deriveFusionStyle({
        pace: "relaxed",
        receptiveness: "open",
        intent: "exploring",
        readiness: { score: 0.5, band: "medium", offerSubmit: false },
        abnormalTransition: null,
        scrollPosture,
      })
    ).toBe("wait");
  });

  it("fast_search triggers needs_help_choosing", () => {
    const scrollPosture = deriveScrollPosture(browseWithScroll("fast_search"));

    expect(
      synthesizePredictedNeed({
        intent: "comparing",
        mealStage: "pre_order",
        receptiveness: "neutral",
        pace: "rushed",
        scrollPosture,
      })
    ).toBe("needs_help_choosing");
  });

  it("reached_bottom + open receptiveness → needs_help_choosing", () => {
    const scrollPosture = deriveScrollPosture(
      browseWithScroll("reached_bottom")
    );

    expect(
      synthesizePredictedNeed({
        intent: "exploring",
        mealStage: "pre_order",
        receptiveness: "open",
        pace: "normal",
        scrollPosture,
      })
    ).toBe("needs_help_choosing");
  });
});

describe("foldGuestMentalModel scroll wiring", () => {
  it("folds scroll posture and price ceiling into mental model", () => {
    const browse = browseWithScroll("fast_search");
    const mental = foldGuestMentalModel({
      timeline: [],
      browse,
      conversation: emptyConversationModel(),
      commerce: {
        orders: [],
        cart: { ai: emptyCartState(), visibleLines: [] },
      },
      session: { billSettled: false },
      conversationMeta: { flowNodeId: "collect", dismissedNudges: [] },
      phase: "browsing",
      config: CONCIERGE_PLATFORM_DEFAULTS,
      now: NOW,
    });

    expect(mental.scrollPosture.searching).toBe(true);
    expect(mental.pace).toBe("rushed");
    expect(mental.priceAffinity).toBe("budget");
    expect(mental.priceCeilingEur).toBe(12);
    expect(mental.predictedNeed).toBe("needs_help_choosing");
  });
});

describe("mental model intelligence scroll gating", () => {
  it("blocks generic upsells when deferUpsell is active", () => {
    const mental = {
      ...emptyGuestMentalModel(NOW),
      scrollPosture: deriveScrollPosture(
        browseWithScroll("slow_category", "Pizza")
      ),
      receptiveness: "open" as const,
      nudgeBudget: { remaining: 3, max: 3, cooldownUntil: null },
    };

    const filtered = filterProactiveCandidatesByMentalModel({
      candidates: [
        { nudge: { kind: "browse_nudge" as GuestProactiveNudgeKind } },
        { nudge: { kind: "scroll_category" as GuestProactiveNudgeKind } },
      ],
      mental,
      enforce: true,
    });

    expect(filtered.map((row) => row.nudge.kind)).toEqual(["scroll_category"]);
  });

  it("includes scroll and price ceiling in GMM block", () => {
    const mental = {
      ...emptyGuestMentalModel(NOW),
      scrollPosture: deriveScrollPosture(browseWithScroll("fast_search")),
      priceAffinity: "budget" as const,
      priceCeilingEur: 12,
      pace: "rushed" as const,
    };

    const block = formatGuestMentalModelBlock(mental);
    expect(block).toContain("scroll_intent: fast_search");
    expect(block).toContain("price_ceiling_eur: 12");
    expect(block).toContain("fast scroll");
  });
});

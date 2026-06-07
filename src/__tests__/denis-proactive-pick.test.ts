import { describe, expect, it } from "vitest";
import { emptyGuestOfferContext } from "@/lib/denis/cognition/offer/empty-guest-offer-context";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import { pickProactiveCandidate } from "@/lib/denis/cognition/proactive/pick-proactive-candidate";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";

const messages = {
  browse: "Browse",
  dessert: "Dessert",
  slowKitchen: "Slow",
  guestWelcome: "Welcome",
  browseFollowUp: "Follow up?",
  billPrompt: "Bill",
  orderDelay: "Delay",
  popularityPair: "Pair",
};

describe("pickProactiveCandidate (ADR-040 UPDS)", () => {
  it("enforce + low confidence → silence (not policy bypass)", () => {
    const config = {
      ...CONCIERGE_PLATFORM_DEFAULTS,
      mentalModel: {
        ...CONCIERGE_PLATFORM_DEFAULTS.mentalModel,
        mode: "enforce" as const,
        confidenceFallbackThreshold: 0.4,
      },
      proactive: {
        ...CONCIERGE_PLATFORM_DEFAULTS.proactive,
        offerEnrich: true,
      },
    };

    const mental = {
      ...emptyGuestMentalModel(),
      confidence: 0.2,
      intent: "exploring" as const,
      predictedNeed: "needs_help_choosing" as const,
      receptiveness: "open" as const,
      nudgeBudget: { remaining: 2, max: 2, cooldownUntil: null },
    };

    const result = pickProactiveCandidate({
      config,
      orders: [],
      mental,
      offer: emptyGuestOfferContext(),
      payload: {
        sessionPhase: "browsing",
        dismissedNudgeKeys: [],
        guestMessageCount: 2,
        browseMinutes: 5,
        cartItemCount: 0,
        hasSessionOrders: false,
      },
      messages,
    });

    expect(result.candidate).toBeNull();
    expect(result.policyTrace?.reason).toBe("gmm.confidence_insufficient");
    expect(result.policyTrace?.enforced).toBe(true);
  });
});

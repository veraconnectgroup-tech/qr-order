import { describe, expect, it } from "vitest";
import { compileBeliefs, CORE_BELIEF_KEYS, getBeliefValue } from "@/lib/denis/cognition/beliefs";
import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { emptyConversationModel } from "@/lib/denis/cognition/conversation/empty-conversation-model";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import { emptyGuestOfferContext } from "@/lib/denis/cognition/offer/empty-guest-offer-context";
import { narrateOfferFromBeliefs } from "@/lib/denis/cognition/offer/narrate-offer-from-beliefs";
import { decideTurnPlan } from "@/lib/denis/cognition/tde/decide-turn-plan";
import { planTurnWithReflex } from "@/lib/denis/kernel/reflex-plan";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { buildMergedCart } from "@/lib/denis/loop/merge-session-cart";
import type { TableSessionState } from "@/lib/denis/loop/types";

function stateWithOffer(): TableSessionState {
  const offer = emptyGuestOfferContext(Date.now());
  return {
    table: { id: "t1", name: "T1", token: "tok" },
    session: {
      id: "s1",
      status: "active",
      accessState: null,
      billSettled: false,
      feedbackSubmitted: false,
      denisEnabled: true,
      denisActive: true,
    },
    commerce: {
      orders: [],
      cart: buildMergedCart({ ai: emptyCartState() }),
    },
    venue: {
      ops: {
        operatingMode: "normal",
        kdsStress: "normal",
        acceptingOrders: true,
        unavailableProductIds: [],
        staffHint: null,
      },
      opsEffects: {
        skipUpsell: false,
        shortenReplies: false,
        empathyNote: null,
        guestSafeStaffHint: null,
      },
    },
    conversation: {
      flowNodeId: "browse",
      foodUpsellAsked: false,
      dismissedNudges: [],
      lastAssistantMessage: null,
      pendingSlot: null,
      model: emptyConversationModel(),
      obligation: null,
    },
    timeline: [],
    browse: {
      ...emptyBrowseProfile(),
      viewedProducts: [
        {
          productId: "11111111-1111-4111-8111-111111111111",
          productName: "Beef Burger",
          categoryPath: ["food", "burgers"],
          viewCount: 2,
          totalDwellMs: 18_000,
          addedToCart: false,
          removedFromCart: false,
          disposition: "viewed",
        },
      ],
    },
    mental: {
      ...emptyGuestMentalModel(),
      predictedNeed: "needs_help_choosing",
      intent: "exploring",
      receptiveness: "open",
    },
    offer: {
      ...offer,
      readiness: { ready: true, reason: "browse_pause", secondsSinceLastBrowseAction: 10 },
      primary: {
        productId: "11111111-1111-4111-8111-111111111111",
        productName: "Beef Burger",
        categoryId: "cat-burgers",
        resolution: "return_view",
        score: 0.92,
        dedupeKey: "offer:return_view:burger",
        isKitchenBlocked: false,
      },
      sequencePattern: "return_view",
      hash: "abc123",
    },
    config: CONCIERGE_PLATFORM_DEFAULTS,
  };
}

describe("offer beliefs GMM-11", () => {
  it("compileBeliefs exposes offer.* and browse focus", () => {
    const graph = compileBeliefs({
      state: stateWithOffer(),
      guestMessage: "šta preporučujete",
      sessionLanguage: "sr",
    });

    expect(getBeliefValue(graph, CORE_BELIEF_KEYS.offerPrimaryProductName)).toBe(
      "Beef Burger"
    );
    expect(getBeliefValue(graph, CORE_BELIEF_KEYS.offerReadinessReady)).toBe(true);
    expect(getBeliefValue(graph, CORE_BELIEF_KEYS.offerResolution)).toBe(
      "return_view"
    );
    expect(getBeliefValue(graph, CORE_BELIEF_KEYS.mentalBrowseFocusProduct)).toBe(
      "11111111-1111-4111-8111-111111111111"
    );
  });

  it("decideTurnPlan uses offer-anchored template for vague recommend", () => {
    const state = stateWithOffer();
    const beliefs = compileBeliefs({
      state,
      guestMessage: "šta preporučujete",
      sessionLanguage: "sr",
    });

    const reflex = planTurnWithReflex({
      config: state.config,
      message: "šta preporučujete",
      flowNodeId: "browse",
      cartState: state.commerce.cart.ai,
      structuredIntent: undefined,
      handoffPaymentMethod: null,
    });

    const plan = decideTurnPlan({
      beliefs,
      reflex,
      message: "šta preporučujete",
    });

    expect(plan.kind).toBe("template_tell");
    expect(plan.reason).toBe("offer.anchored_recommend.llm_reply");
    expect(plan.requiresLlm).toBe(true);
  });

  it("narrateOfferFromBeliefs matches product in chat copy", () => {
    const beliefs = compileBeliefs({
      state: stateWithOffer(),
      guestMessage: "preporuči mi nešto",
      sessionLanguage: "sr",
    });

    const message = narrateOfferFromBeliefs(beliefs, "sr");
    expect(message).toContain("Beef Burger");
    expect(message).toContain("preporučujem");
  });
});

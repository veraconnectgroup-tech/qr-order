import { describe, expect, it } from "vitest";
import { compileBeliefs } from "@/lib/denis/cognition/beliefs/compile-beliefs";
import { decideTurnPlan } from "@/lib/denis/cognition/tde/decide-turn-plan";
import { emptyConversationModel } from "@/lib/denis/cognition/conversation/empty-conversation-model";
import {
  assessWaiterObligation,
  enforceWaiterTell,
} from "@/lib/denis/cognition/waiter";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { buildMergedCart } from "@/lib/denis/loop/merge-session-cart";
import { emptyOrderDraft } from "@/lib/ai/ordering/draft-types";
import type { TableSessionState } from "@/lib/denis/loop/types";
import { planTurnWithReflex } from "@/lib/denis/kernel/reflex-plan";

function baseState(): TableSessionState {
  return {
    table: { id: "t1", name: "Table 1", token: "tok" },
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
      flowNodeId: "recap",
      foodUpsellAsked: false,
      dismissedNudges: [],
      lastAssistantMessage: null,
      pendingSlot: null,
      model: {
        ...emptyConversationModel(),
        transcript: [
          {
            id: "g1",
            role: "guest",
            text: "moze jedno pivo beef burger",
            at: "2026-05-29T12:00:00Z",
          },
        ],
      },
      obligation: null,
    },
    timeline: [],
    config: CONCIERGE_PLATFORM_DEFAULTS,
  };
}

describe("waiter obligation (ADR-032)", () => {
  it("detects drink gap when burger in cart but pivo unspecified", () => {
    const state = baseState();
    state.commerce.cart.ai.draft.items.push({
      productId: "f1",
      productName: "Beef Burger",
      quantity: 1,
      serveSize: null,
      modifierIds: [],
      notes: "",
      lineTotal: 15,
      menuSection: "food",
    });

    const obligation = assessWaiterObligation({
      orderContextMessage: "moze jedno pivo beef burger",
      cartLines: state.commerce.cart.ai.draft.items,
      pendingSlot: null,
      language: "sr",
      atRecap: true,
    });

    expect(obligation.gaps.some((g) => g.kind === "drink_unspecified")).toBe(
      true
    );
    expect(obligation.canConfirm).toBe(false);
    expect(obligation.nextAction).toBe("clarify_gap");
  });

  it("blocks confirm plan when guest says da with active gap", () => {
    const state = baseState();
    state.commerce.cart.ai.draft.items.push({
      productId: "f1",
      productName: "Beef Burger",
      quantity: 1,
      serveSize: null,
      modifierIds: [],
      notes: "",
      lineTotal: 15,
      menuSection: "food",
    });

    const beliefs = compileBeliefs({
      state,
      guestMessage: "da",
      sessionLanguage: "sr",
    });

    const reflex = planTurnWithReflex({
      config: state.config,
      message: "da",
      flowNodeId: "recap",
      cartState: state.commerce.cart.ai,
      structuredIntent: undefined,
      handoffPaymentMethod: null,
    });

    const plan = decideTurnPlan({
      message: "da",
      beliefs,
      reflex,
      committedFacts: [],
    });

    expect(plan.kind).toBe("template_tell");
    expect(plan.reason).toBe("waiter.gap_blocks_confirm");
    expect(plan.templateKey).toBe("waiter.gap_clarify.drink");
  });

  it("enforceWaiterTell appends drink question to recap", () => {
    const obligation = assessWaiterObligation({
      orderContextMessage: "moze jedno pivo beef burger",
      cartLines: [
        {
          productId: "f1",
          productName: "Beef Burger",
          quantity: 1,
          serveSize: null,
          modifierIds: [],
          notes: "",
          lineTotal: 15,
          menuSection: "food",
        },
      ],
      pendingSlot: null,
      language: "sr",
      atRecap: true,
    });

    const message = enforceWaiterTell({
      message: "Da li je to sve?\nBeef Burger",
      obligation,
      language: "sr",
      draft: emptyOrderDraft(),
    });

    expect(message).toMatch(/Pilsner|Weizen/i);
  });
});

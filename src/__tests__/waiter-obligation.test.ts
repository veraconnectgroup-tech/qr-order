import { describe, expect, it } from "vitest";
import { compileBeliefs } from "@/lib/denis/cognition/beliefs/compile-beliefs";
import { decideTurnPlan } from "@/lib/denis/cognition/tde/decide-turn-plan";
import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { emptyConversationModel } from "@/lib/denis/cognition/conversation/empty-conversation-model";
import {
  assessWaiterObligation,
  enforceWaiterTell,
} from "@/lib/denis/cognition/waiter";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { buildMergedCart } from "@/lib/denis/loop/merge-session-cart";
import { buildViewLayers } from "@/lib/denis/loop/project-view-layers";
import { buildFoldMeta } from "@/lib/denis/loop/compute-truth-hash";
import { emptyOrderDraft } from "@/lib/ai/ordering/draft-types";
import { extractOrderMessageMeta } from "@/lib/ai/ordering/order-message-backfill";
import type { TableSessionState } from "@/lib/denis/loop/types";
import { planTurnWithReflex } from "@/lib/denis/kernel/reflex-plan";
import {
  mergeTableSessionObligation,
  obligationForConversationState,
} from "@/lib/denis/cognition/waiter/merge-table-session-obligation";
import { resolveGuestTableSessionLookupToken } from "@/lib/denis/venue/party";

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
    browse: emptyBrowseProfile(),
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

  it("generic pivo in cart keeps drink_unspecified gap (eval/live parity)", () => {
    const meta = extractOrderMessageMeta("moze jedno pivo i beef burger");
    expect(meta.needsDrinkClarify).toBe(true);

    const cartLines = [
      {
        productId: "f1",
        productName: "Beef Burger",
        quantity: 1,
        serveSize: null,
        modifierIds: [],
        notes: "",
        lineTotal: 15,
        menuSection: "food" as const,
      },
      {
        productId: "d1",
        productName: "Pivo",
        quantity: 1,
        serveSize: null,
        modifierIds: [],
        notes: "",
        lineTotal: 4,
        menuSection: "drinks" as const,
      },
    ];

    const obligation = assessWaiterObligation({
      orderContextMessage: "moze jedno pivo i beef burger",
      cartLines,
      pendingSlot: null,
      language: "sr",
      atRecap: true,
    });

    expect(obligation.gaps).toHaveLength(1);
    expect(obligation.gaps[0]?.kind).toBe("drink_unspecified");
    expect(obligation.canConfirm).toBe(false);

    const state = baseState();
    state.commerce.cart.ai.draft.items.push(...cartLines);
    state.conversation.obligation = obligationForConversationState(obligation);

    const layers = buildViewLayers(
      state,
      buildFoldMeta(state, "s1", null, "ordering"),
      null
    );
    expect(
      layers.some(
        (layer) =>
          layer.kind === "banner" &&
          String(layer.id ?? "").includes("waiter-gap")
      )
    ).toBe(true);

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
      structuredIntent: "CONFIRM",
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
  });

  it("template clarify plan when beliefs carry open drink gap on order line", () => {
    const state = baseState();
    state.conversation.flowNodeId = "collect";
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
      guestMessage: "moze jedno pivo i beef burger",
      sessionLanguage: "sr",
    });
    const reflex = planTurnWithReflex({
      config: state.config,
      message: "moze jedno pivo i beef burger",
      flowNodeId: "collect",
      cartState: state.commerce.cart.ai,
      structuredIntent: undefined,
      handoffPaymentMethod: null,
    });

    const plan = decideTurnPlan({
      message: "moze jedno pivo i beef burger",
      beliefs,
      reflex,
      committedFacts: [],
    });

    expect(plan.kind).toBe("template_tell");
    expect(plan.reason).toBe("waiter.gap_clarify");
    expect(plan.requiresLlm).toBe(false);
  });

  it("reflex drink reply when guest names typed drink with open gap", () => {
    const state = baseState();
    state.conversation.flowNodeId = "recap";
    state.conversation.model.transcript = [
      {
        id: "g1",
        role: "guest",
        text: "moze jedno pivo i beef burger",
        at: new Date().toISOString(),
      },
    ];
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
      guestMessage: "pilsner",
      sessionLanguage: "sr",
    });
    const reflex = planTurnWithReflex({
      config: state.config,
      message: "pilsner",
      flowNodeId: "recap",
      cartState: state.commerce.cart.ai,
    });
    const plan = decideTurnPlan({
      message: "pilsner",
      beliefs,
      reflex,
      committedFacts: [],
    });

    expect(plan.reason).toBe("waiter.gap_resolved.drink_reply");
    expect(plan.requiresLlm).toBe(false);
  });

  it("reflex confirm submit when obligation clear at recap", () => {
    const state = baseState();
    state.conversation.flowNodeId = "recap";
    state.commerce.cart.ai.draft.items.push(
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
      {
        productId: "d1",
        productName: "Pilsner",
        quantity: 1,
        serveSize: "0.5L",
        modifierIds: [],
        notes: "",
        lineTotal: 5,
        menuSection: "drinks",
      }
    );

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
      structuredIntent: "CONFIRM",
    });
    const plan = decideTurnPlan({
      message: "da",
      beliefs,
      reflex,
      committedFacts: [],
    });

    expect(plan.reason).toBe("commerce.confirm.reflex_submit");
    expect(plan.requiresLlm).toBe(false);
  });

  it("fold merge keeps drink gap from transcript order line (view parity)", () => {
    const state = baseState();
    state.conversation.flowNodeId = "recap";
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
    state.conversation.model.transcript = [
      {
        id: "g1",
        role: "guest",
        text: "moze jedno pivo i beef burger",
        at: "2026-05-29T12:00:00Z",
      },
    ];

    const obligation = mergeTableSessionObligation({
      state,
      source: "fold",
    });

    expect(obligation.gaps.some((g) => g.kind === "drink_unspecified")).toBe(
      true
    );
    state.conversation.obligation = obligationForConversationState(obligation);

    const layers = buildViewLayers(
      state,
      buildFoldMeta(state, "s1", "ai-1", "ordering"),
      null
    );
    expect(
      layers.some(
        (layer) =>
          layer.kind === "banner" &&
          String(layer.id ?? "").includes("waiter-gap")
      )
    ).toBe(true);
  });

  it("substitution gap surfaces in enforceWaiterTell", () => {
    const obligation = assessWaiterObligation({
      guestMessage: "beef burger sa salatom umesto pomfrita",
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

    expect(obligation.gaps.some((g) => g.kind === "substitution_note")).toBe(
      true
    );

    const message = enforceWaiterTell({
      message: "Beef Burger — da li je to sve?",
      obligation,
      language: "sr",
      draft: emptyOrderDraft(),
    });

    expect(message).toMatch(/pomfrit|kuhinj|Napomena/i);
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

describe("resolveGuestTableSessionLookupToken", () => {
  it("prefers tableSessionToken over QR aiContext sessionToken", () => {
    expect(
      resolveGuestTableSessionLookupToken({
        tableSessionToken: "guest-session-abc",
        sessionToken: "demo-table-1",
      })
    ).toBe("guest-session-abc");
  });

  it("falls back to sessionToken when tableSessionToken is absent", () => {
    expect(
      resolveGuestTableSessionLookupToken({
        sessionToken: "guest-only-token",
      })
    ).toBe("guest-only-token");
  });
});

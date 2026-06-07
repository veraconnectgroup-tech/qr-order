import { describe, expect, it } from "vitest";
import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { emptyConversationModel } from "@/lib/denis/cognition/conversation/empty-conversation-model";
import { planProactiveTurn } from "@/lib/denis/cognition/proactive/plan-proactive-turn";
import {
  assessWaiterObligation,
  detectWaiterObligationTell,
} from "@/lib/denis/cognition/waiter";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { buildMergedCart } from "@/lib/denis/loop/merge-session-cart";
import type { TableSessionState } from "@/lib/denis/loop/types";

function stateWithBurgerGap(): TableSessionState {
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
      cart: buildMergedCart({
        ai: {
          ...emptyCartState(),
          draft: {
            cartRevision: 1,
            items: [
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
          },
        },
      }),
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
      obligation,
    },
    timeline: [],
    browse: emptyBrowseProfile(),
    config: CONCIERGE_PLATFORM_DEFAULTS,
  };
}

describe("waiter autonomous tell", () => {
  it("detectWaiterObligationTell writes drink clarify without guest turn", () => {
    const state = stateWithBurgerGap();
    const nudge = detectWaiterObligationTell(state, "sr");
    expect(nudge?.kind).toBe("waiter_gap");
    expect(nudge?.message).toMatch(/Pilsner|Weizen/i);
    expect(nudge?.message).toContain("Beef Burger");
  });

  it("planProactiveTurn prioritizes waiter_gap over welcome", () => {
    const state = stateWithBurgerGap();
    const result = planProactiveTurn({
      state,
      config: state.config,
      orders: [],
      sessionPhase: "ordering",
      payload: {
        sessionAgeSeconds: 5,
        guestMessageCount: 1,
        cartItemCount: 1,
        language: "sr",
      },
    });

    expect(result.skipped).toBe(false);
    expect(result.candidateKind).toBe("waiter_gap");
    expect(result.message).toMatch(/Pilsner|Weizen/i);
  });

  it("does not repeat obligation tell already in transcript", () => {
    const state = stateWithBurgerGap();
    const first = detectWaiterObligationTell(state, "sr");
    expect(first).not.toBeNull();

    state.conversation.model.transcript.push({
      id: "d1",
      role: "denis",
      text: first!.message,
      at: "2026-05-29T12:01:00Z",
    });
    state.conversation.model.thread.lastDenisText = first!.message;

    expect(detectWaiterObligationTell(state, "sr")).toBeNull();
  });
});

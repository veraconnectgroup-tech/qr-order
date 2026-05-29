import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import {
  compileBeliefs,
  CORE_BELIEF_KEYS,
  getBeliefValue,
} from "@/lib/denis/cognition/beliefs";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { buildMergedCart } from "@/lib/denis/loop/merge-session-cart";
import type { TableSessionState } from "@/lib/denis/loop/types";

export type BeliefsFixtureResult = {
  passed: boolean;
  errors: string[];
  beliefCount: number;
};

function baseState(
  overrides: Partial<TableSessionState> = {}
): TableSessionState {
  const config = {
    ...CONCIERGE_PLATFORM_DEFAULTS,
    memory: { ...CONCIERGE_PLATFORM_DEFAULTS.memory, returnGuestEnabled: true },
  };

  return {
    table: { id: "table-1", name: "T1", token: "tok" },
    session: {
      id: "sess-1",
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
      flowNodeId: "welcome",
      foodUpsellAsked: false,
      dismissedNudges: [],
      lastAssistantMessage: null,
    },
    timeline: [],
    config,
    ...overrides,
  };
}

/** Golden fixture — compileBeliefs produces 6 core beliefs (ADR-023 MR-1). */
export function runBeliefsCompileFixture(): BeliefsFixtureResult {
  const errors: string[] = [];

  const banterGraph = compileBeliefs({
    state: baseState(),
    guestMessage: "Denis legendo gde si",
    sessionLanguage: "de",
  });

  if (banterGraph.beliefs.length !== 7) {
    errors.push(
      `expected 7 beliefs (6 core + require_confirm), got ${banterGraph.beliefs.length}`
    );
  }

  const banterMode = getBeliefValue<string>(
    banterGraph,
    CORE_BELIEF_KEYS.conversationMode
  );
  if (banterMode !== "banter") {
    errors.push(`banter message: expected mode=banter, got ${banterMode ?? "null"}`);
  }

  const banterLang = getBeliefValue<string>(
    banterGraph,
    CORE_BELIEF_KEYS.conversationLanguage
  );
  if (banterLang !== "sr") {
    errors.push(`banter message: expected language=sr, got ${banterLang ?? "null"}`);
  }

  const orderGraph = compileBeliefs({
    state: baseState(),
    guestMessage: "1x Cola 0,5L",
    sessionLanguage: "de",
  });
  const orderMode = getBeliefValue<string>(
    orderGraph,
    CORE_BELIEF_KEYS.conversationMode
  );
  if (orderMode !== "ordering") {
    errors.push(`order line: expected mode=ordering, got ${orderMode ?? "null"}`);
  }

  const rushGraph = compileBeliefs({
    state: baseState({
      venue: {
        ops: {
          operatingMode: "rush",
          kdsStress: "high",
          acceptingOrders: true,
          unavailableProductIds: [],
          staffHint: null,
        },
        opsEffects: {
          skipUpsell: true,
          shortenReplies: true,
          empathyNote: "Kitchen is busy",
          guestSafeStaffHint: null,
        },
      },
    }),
    guestMessage: "još jedno pivo",
    sessionLanguage: "sr",
  });

  if (getBeliefValue<boolean>(rushGraph, CORE_BELIEF_KEYS.venueRush) !== true) {
    errors.push("rush ops: expected venue.rush=true");
  }
  if (
    getBeliefValue<boolean>(rushGraph, CORE_BELIEF_KEYS.venueSkipUpsell) !== true
  ) {
    errors.push("rush ops: expected venue.skip_upsell=true");
  }

  const returnGraph = compileBeliefs({
    state: baseState({
      guest: {
        favoriteProductIds: [],
        allergySheetIds: [],
        allergyLabels: [],
        preferredLanguage: "sr",
        visitCount: 3,
        lastVisitItemNames: ["Pils"],
        lastVisitAt: "2026-05-01T12:00:00.000Z",
      },
    }),
    guestMessage: "da",
    sessionLanguage: "de",
  });
  if (
    getBeliefValue<boolean>(returnGraph, CORE_BELIEF_KEYS.guestReturnVisit) !==
    true
  ) {
    errors.push("return guest: expected guest.return_visit=true");
  }

  const slotGraph = compileBeliefs({
    state: baseState({
      commerce: {
        orders: [],
        cart: buildMergedCart({
          ai: {
            draft: {
              cartRevision: 1,
              items: [
                {
                  productId: "prod-cola",
                  productName: "Cola",
                  quantity: 1,
                  serveSize: null,
                  modifierIds: [],
                  notes: "",
                  lineTotal: 3.5,
                  menuSection: "drinks",
                },
              ],
            },
            undoStack: [],
          },
        }),
      },
    }),
    guestMessage: "velika",
    sessionLanguage: "sr",
  });
  const pendingSlot = getBeliefValue<string>(
    slotGraph,
    CORE_BELIEF_KEYS.commercePendingSlot
  );
  if (pendingSlot !== "serve_size") {
    errors.push(
      `missing serve size: expected commerce.pending_slot=serve_size, got ${pendingSlot ?? "null"}`
    );
  }

  const confirmGraph = compileBeliefs({
    state: baseState(),
    guestMessage: "hello",
    sessionLanguage: "en",
  });
  if (
    getBeliefValue<boolean>(
      confirmGraph,
      CORE_BELIEF_KEYS.policyRequireConfirm
    ) !== true
  ) {
    errors.push("policy: expected policy.require_confirm=true from defaults");
  }

  return {
    passed: errors.length === 0,
    errors,
    beliefCount: banterGraph.beliefs.length,
  };
}

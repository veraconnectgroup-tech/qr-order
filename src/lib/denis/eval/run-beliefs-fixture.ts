import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { emptyGuestOfferContext } from "@/lib/denis/cognition/offer/empty-guest-offer-context";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import { emptyConversationModel } from "@/lib/denis/cognition/conversation/empty-conversation-model";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import {
  compileBeliefs,
  CORE_BELIEF_KEYS,
  getBeliefValue,
  resolveBeliefConflicts,
} from "@/lib/denis/cognition/beliefs";
import {
  computeDecayedConfidence,
} from "@/lib/denis/cognition/beliefs/belief-confidence";
import { DEFAULT_BELIEF_DECAY_CONFIG } from "@/lib/denis/cognition/mental-model/mental-model-types";
import { foldMinimalBeliefs } from "@/lib/denis/kernel/fold-beliefs";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { buildMergedCart } from "@/lib/denis/loop/merge-session-cart";
import type { TableSessionState } from "@/lib/denis/loop/types";
import { emptyGuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";

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
      pendingSlot: null,
      model: emptyConversationModel(),
      obligation: null,
    },
    timeline: [],
    browse: emptyBrowseProfile(),
    mental: emptyGuestMentalModel(),
    offer: emptyGuestOfferContext(),
    config,
    ...overrides,
  };
}

/** Golden fixture — compileBeliefs produces 6 core beliefs (ADR-023 MR-1). */
function runBeliefsCompileCoreFixture(): BeliefsFixtureResult {
  const errors: string[] = [];

  const banterGraph = compileBeliefs({
    state: baseState(),
    guestMessage: "Denis legendo gde si",
    sessionLanguage: "de",
  });

  if (banterGraph.beliefs.length < 27) {
    errors.push(
      `expected at least 27 beliefs (ADR-030 core + ADR-032 waiter + ADR-038 mental + GMM-11 offer), got ${banterGraph.beliefs.length}`
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
                  serveSize: "0.5L",
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
    guestMessage: "još jedno",
    sessionLanguage: "de",
  });
  const orderMode = getBeliefValue<string>(
    orderGraph,
    CORE_BELIEF_KEYS.conversationMode
  );
  if (orderMode !== "ordering") {
    errors.push(`open cart: expected mode=ordering, got ${orderMode ?? "null"}`);
  }
  const orderPressure = getBeliefValue<string>(
    orderGraph,
    CORE_BELIEF_KEYS.commercePressure
  );
  if (orderPressure !== "open") {
    errors.push(
      `open cart: expected commerce.pressure=open, got ${orderPressure ?? "null"}`
    );
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
      guest: emptyGuestMemoryProjection({
        preferredLanguage: "sr",
        visitCount: 3,
        lastVisitItemNames: ["Pils"],
        favoriteItems: ["Pils"],
        lastVisitAt: "2026-05-01T12:00:00.000Z",
        lastVisit: "2026-05-01T12:00:00.000Z",
      }),
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
  const awaiting = getBeliefValue<string>(
    slotGraph,
    CORE_BELIEF_KEYS.conversationAwaiting
  );
  if (awaiting !== "serve_size") {
    errors.push(
      `missing serve size: expected conversation.awaiting=serve_size, got ${awaiting ?? "null"}`
    );
  }
  const slotMode = getBeliefValue<string>(
    slotGraph,
    CORE_BELIEF_KEYS.conversationMode
  );
  if (slotMode !== "ordering") {
    errors.push(
      `missing serve size: expected mode=ordering, got ${slotMode ?? "null"}`
    );
  }

  const typoGraph = compileBeliefs({
    state: baseState({
      commerce: {
        orders: [],
        cart: buildMergedCart({
          ai: {
            draft: {
              cartRevision: 1,
              items: [
                {
                  productId: "prod-pivo",
                  productName: "Pivo",
                  quantity: 1,
                  serveSize: null,
                  modifierIds: [],
                  notes: "",
                  lineTotal: 4.5,
                  menuSection: "drinks",
                },
              ],
            },
            undoStack: [],
          },
        }),
      },
    }),
    guestMessage: "Veliko povo",
    sessionLanguage: "sr",
  });
  const typoMode = getBeliefValue<string>(
    typoGraph,
    CORE_BELIEF_KEYS.conversationMode
  );
  if (typoMode !== "ordering") {
    errors.push(
      `typo with pending slot: expected mode=ordering, got ${typoMode ?? "null"}`
    );
  }

  const draftPendingGraph = compileBeliefs({
    state: baseState({
      conversation: {
        flowNodeId: "collect",
        foodUpsellAsked: false,
        dismissedNudges: [],
        lastAssistantMessage: "0.3L ili 0.5L?",
        pendingSlot: "serve_size",
        model: emptyConversationModel(),
      obligation: null,
      },
    }),
    guestMessage: "veliko",
    sessionLanguage: "sr",
  });
  const draftPendingSlot = getBeliefValue<string>(
    draftPendingGraph,
    CORE_BELIEF_KEYS.commercePendingSlot
  );
  if (draftPendingSlot !== "serve_size") {
    errors.push(
      `draft pending slot: expected serve_size, got ${draftPendingSlot ?? "null"}`
    );
  }

  const thanksWithCartGraph = compileBeliefs({
    state: baseState({
      commerce: {
        orders: [],
        cart: buildMergedCart({
          ai: {
            draft: {
              cartRevision: 1,
              items: [
                {
                  productId: "prod-pils",
                  productName: "Pilsner",
                  quantity: 1,
                  serveSize: "0.5L",
                  modifierIds: [],
                  notes: "",
                  lineTotal: 4.5,
                  menuSection: "drinks",
                },
              ],
            },
            undoStack: [],
          },
        }),
      },
    }),
    guestMessage: "hvala",
    sessionLanguage: "sr",
  });
  const thanksMode = getBeliefValue<string>(
    thanksWithCartGraph,
    CORE_BELIEF_KEYS.conversationMode
  );
  if (thanksMode !== "ordering") {
    errors.push(
      `hvala with cart: expected mode=ordering, got ${thanksMode ?? "null"}`
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

  const mentalIntent = getBeliefValue<string>(
    banterGraph,
    CORE_BELIEF_KEYS.mentalIntent
  );
  if (mentalIntent !== "arrived") {
    errors.push(`mental.intent: expected arrived, got ${mentalIntent ?? "null"}`);
  }

  const mentalPredictedNeed = getBeliefValue<string>(
    banterGraph,
    CORE_BELIEF_KEYS.mentalPredictedNeed
  );
  if (mentalPredictedNeed !== "none") {
    errors.push(
      `mental.predicted_need: expected none, got ${mentalPredictedNeed ?? "null"}`
    );
  }

  const mentalPriceAffinity = getBeliefValue<string>(
    banterGraph,
    CORE_BELIEF_KEYS.mentalPriceAffinity
  );
  if (mentalPriceAffinity !== "unknown") {
    errors.push(
      `mental.price_affinity: expected unknown, got ${mentalPriceAffinity ?? "null"}`
    );
  }

  return {
    passed: errors.length === 0,
    errors,
    beliefCount: 27,
  };
}

function timelineRow(
  seq: number,
  event_type: DenisTimelineRow["event_type"],
  payload: DenisTimelineRow["payload"],
  created_at: string
): DenisTimelineRow {
  return {
    id: `id-${seq}`,
    ai_session_id: "session-1",
    seq,
    event_type,
    payload,
    trace_id: `trace-${seq}`,
    context_hash: null,
    created_at,
  };
}

/** Prompt 91 — decay, reinforcement, conflict, propagation scenarios. */
export function runBeliefConfidenceFixture(): BeliefsFixtureResult {
  const errors: string[] = [];
  const baseNow = Date.parse("2026-06-28T12:00:00.000Z");

  const allergyFold = foldMinimalBeliefs(
    [
      timelineRow(1, "perception.ingested", {
        type: "perception.ingested",
        frame: {
          channel: "chat.message",
          normalizedText: "bez glutena molim",
          structuredIntent: null,
          ingestedAt: "2026-06-28T11:40:00.000Z",
        },
      }, "2026-06-28T11:40:00.000Z"),
    ],
    { nowMs: baseNow }
  );
  const allergyConf = allergyFold.guest.allergies?.confidence ?? 0;
  if (allergyConf < 0.99) {
    errors.push(`allergy decay: expected ~1.0 after 20min, got ${allergyConf}`);
  }

  const intentFold = foldMinimalBeliefs(
    [
      timelineRow(1, "perception.ingested", {
        type: "perception.ingested",
        frame: {
          channel: "chat.message",
          normalizedText: "mozda burger",
          structuredIntent: null,
          ingestedAt: "2026-06-28T11:54:00.000Z",
        },
      }, "2026-06-28T11:54:00.000Z"),
    ],
    { nowMs: baseNow }
  );
  const intentConf = intentFold.guest.lastUserIntent?.confidence ?? 1;
  if (intentConf > 0.55) {
    errors.push(
      `intent decay: expected <=0.55 after 6min, got ${intentConf}`
    );
  }

  const reinforcedFold = foldMinimalBeliefs(
    [
      timelineRow(1, "perception.ingested", {
        type: "perception.ingested",
        frame: {
          channel: "chat.message",
          normalizedText: "bez glutena",
          structuredIntent: null,
          ingestedAt: "2026-06-28T11:55:00.000Z",
        },
      }, "2026-06-28T11:55:00.000Z"),
      timelineRow(2, "perception.ingested", {
        type: "perception.ingested",
        frame: {
          channel: "chat.message",
          normalizedText: "bez glutena",
          structuredIntent: null,
          ingestedAt: "2026-06-28T11:56:00.000Z",
        },
      }, "2026-06-28T11:56:00.000Z"),
    ],
    { nowMs: baseNow }
  );
  if (reinforcedFold.guest.allergies?.confidence !== 1) {
    errors.push(
      `reinforcement: expected allergy confidence 1.0, got ${reinforcedFold.guest.allergies?.confidence}`
    );
  }

  const propagated = allergyFold.propagated.find((row) => row.key === "menu.filter");
  if (!propagated || propagated.value !== "no_gluten") {
    errors.push("propagation: expected menu.filter=no_gluten from gluten allergy");
  }

  const conflictLog: Array<{
    key: string;
    winnerValue: unknown;
    winnerSource: string;
    winnerConfidence: number;
    rejected: Array<{ value: unknown; source: string; confidence: number }>;
    resolvedAtMs: number;
  }> = [];
  const resolved = resolveBeliefConflicts(
    [
      {
        key: "guest.lastUserIntent",
        value: "exploring",
        confidence: 0.5,
        source: "inferred",
        observedAtMs: baseNow - 6 * 60 * 1000,
      },
      {
        key: "guest.lastUserIntent",
        value: "decided",
        confidence: 1,
        source: "explicit",
        observedAtMs: baseNow,
      },
    ],
    conflictLog,
    baseNow
  );
  if (resolved[0]?.value !== "decided") {
    errors.push("conflict: expected latest explicit intent to win");
  }
  if (conflictLog.length === 0) {
    errors.push("conflict: expected conflict log entry");
  }

  const glutenGraph = compileBeliefs({
    state: baseState({
      guest: emptyGuestMemoryProjection({
        allergyLabels: ["gluten"],
        allergies: ["gluten"],
        preferredLanguage: "sr",
        visitCount: 1,
        lastVisitItemNames: ["Pils"],
        favoriteItems: ["Pils"],
      }),
    }),
    guestMessage: "zdravo",
    sessionLanguage: "sr",
    nowMs: baseNow,
  });
  const menuFilter = getBeliefValue<string>(
    glutenGraph,
    CORE_BELIEF_KEYS.menuFilter
  );
  if (menuFilter !== "no_gluten") {
    errors.push(
      `compile propagation: expected menu.filter=no_gluten, got ${menuFilter ?? "null"}`
    );
  }

  const decayedMental = computeDecayedConfidence(
    0.9,
    baseNow - 6 * 60 * 1000,
    baseNow,
    "intent",
    DEFAULT_BELIEF_DECAY_CONFIG
  );
  if (decayedMental > 0.55) {
    errors.push(`computeDecayedConfidence intent: expected <=0.55, got ${decayedMental}`);
  }

  return {
    passed: errors.length === 0,
    errors,
    beliefCount: 0,
  };
}

export function runBeliefsCompileFixture(): BeliefsFixtureResult {
  const compileResult = runBeliefsCompileCoreFixture();
  const confidenceResult = runBeliefConfidenceFixture();
  return {
    passed: compileResult.passed && confidenceResult.passed,
    errors: [...compileResult.errors, ...confidenceResult.errors],
    beliefCount: compileResult.beliefCount,
  };
}


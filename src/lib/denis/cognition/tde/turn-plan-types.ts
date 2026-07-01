import type { ConversationGraph } from "@/lib/denis/cognition/conversation/conversation-graph";
import type { DenisGoal } from "@/lib/denis/kernel/goal-types";
import type { ReflexTurnResult } from "@/lib/denis/kernel/reflex-plan";

/** ADR-023 §3.2 — scored belief (MR-1 compileBeliefs output shape). */
export type BeliefSource =
  | "explicit"
  | "inferred"
  | "ops"
  | "memory"
  | "default";

export type Belief<T = unknown> = {
  key: string;
  value: T;
  confidence: number;
  source: BeliefSource;
  expiresAt?: string;
};

export type BeliefGraph = {
  beliefs: Belief[];
};

export const CORE_BELIEF_KEYS = {
  conversationLanguage: "conversation.language",
  conversationMode: "conversation.mode",
  conversationAwaiting: "conversation.awaiting",
  commercePendingSlot: "commerce.pending_slot",
  commercePressure: "commerce.pressure",
  commerceAwaitingConfirm: "commerce.awaiting_confirm",
  commerceHasOpenOrders: "commerce.has_open_orders",
  commerceHasDeliveredOrders: "commerce.has_delivered_orders",
  venueRush: "venue.rush",
  venueSkipUpsell: "venue.skip_upsell",
  guestReturnVisit: "guest.return_visit",
  policyRequireConfirm: "policy.require_confirm",
  waiterGapCount: "waiter.gap_count",
  waiterCanConfirm: "waiter.can_confirm",
  waiterPrimaryGap: "waiter.primary_gap",
  waiterNextAction: "waiter.next_action",
  mentalIntent: "mental.intent",
  mentalReceptiveness: "mental.receptiveness",
  mentalFrustration: "mental.frustration",
  mentalPredictedNeed: "mental.predicted_need",
  mentalPriceAffinity: "mental.price_affinity",
  offerPrimaryProductId: "offer.primary_product_id",
  offerPrimaryProductName: "offer.primary_product_name",
  offerAlternativeProductName: "offer.alternative_product_name",
  offerResolution: "offer.resolution",
  offerReadinessReady: "offer.readiness_ready",
  offerPrimaryKitchenBlocked: "offer.primary_kitchen_blocked",
  mentalBrowseFocusProduct: "mental.browse_focus_product",
} as const;

export type ConversationMode = "banter" | "ordering" | "settling";

export type CommercePressure = "none" | "open" | "confirm";

import type { PendingSlotKind } from "@/lib/denis/platform/pending-slot-types";

export type { PendingSlotKind };

export type ConversationAwaiting =
  | PendingSlotKind
  | "confirm"
  | "browse_decision"
  | "recommendation_pick"
  | "clarify_intent"
  | null;

export type TurnPlanKind =
  | "reflex_only"
  | "template_tell"
  | "slot_extract"
  | "transactional_perceive"
  | "relational_perceive"
  | "narrate_paraphrase";

export type TurnPlan = {
  kind: TurnPlanKind;
  requiresLlm: boolean;
  /** When true, DECIDE must not attach upsell goals (rush / venue.skip_upsell). */
  suppressUpsell: boolean;
  reason: string;
  templateKey?: string;
};

export type UtteranceIntent =
  | "banter_welcome"
  | "slot_clarify"
  | "status_headline"
  | "status_no_order"
  | "cart_conflict"
  | "settle_thanks"
  | "generic_nudge";

export type UtterancePlan = {
  intent: UtteranceIntent;
  language: string;
  templateKey: string;
  facts: Record<string, string | number | boolean | undefined>;
  /** Template-first path — no perceive LLM when true and tryTemplate succeeds. */
  useTemplate: boolean;
  requiresNarrateLlm: boolean;
};

export type CommittedFact = {
  key: string;
  value: string;
};

export type DecideTurnPlanInput = {
  beliefs: BeliefGraph;
  reflex: Pick<
    ReflexTurnResult,
    "usedT0" | "handoffCommand" | "reflex" | "plan"
  >;
  message: string;
  committedFacts?: CommittedFact[];
  conversationGraph?: ConversationGraph | null;
  interpretation?: import("@/lib/denis/cognition/tde/turn-interpretation-types").TurnInterpretation | null;
};

export type PlanUtteranceInput = {
  beliefs: BeliefGraph;
  turnPlan: TurnPlan;
  topGoal: DenisGoal | null;
  committedFacts?: CommittedFact[];
};

export function belief<T>(
  key: string,
  value: T,
  source: BeliefSource = "inferred",
  confidence = 0.85
): Belief<T> {
  return { key, value, confidence, source };
}

export function beliefGraph(entries: Belief[]): BeliefGraph {
  return { beliefs: entries };
}

export function getBelief<T>(
  graph: BeliefGraph,
  key: string
): Belief<T> | undefined {
  const matches = graph.beliefs.filter((b) => b.key === key);
  if (matches.length === 0) return undefined;
  return matches.reduce((best, cur) =>
    cur.confidence > best.confidence ? cur : best
  ) as Belief<T>;
}

export function getBeliefValue<T>(
  graph: BeliefGraph,
  key: string
): T | undefined {
  return getBelief<T>(graph, key)?.value;
}

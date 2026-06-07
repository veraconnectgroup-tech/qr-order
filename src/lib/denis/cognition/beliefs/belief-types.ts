/** ADR-023 §3.2 — scored belief graph (MR-1 compileBeliefs). */

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
  venueRush: "venue.rush",
  venueSkipUpsell: "venue.skip_upsell",
  guestReturnVisit: "guest.return_visit",
  commerceHasOpenOrders: "commerce.has_open_orders",
  policyRequireConfirm: "policy.require_confirm",
  waiterGapCount: "waiter.gap_count",
  waiterCanConfirm: "waiter.can_confirm",
  waiterPrimaryGap: "waiter.primary_gap",
  waiterNextAction: "waiter.next_action",
  mentalIntent: "mental.intent",
  mentalReceptiveness: "mental.receptiveness",
  mentalFrustration: "mental.frustration",
  mentalPredictedNeed: "mental.predicted_need",
} as const;

export type ConversationMode = "banter" | "ordering" | "settling";

export type CommercePressure = "none" | "open" | "confirm";

/** What Denis is waiting for the guest to answer (ADR-030 dialogue frame). */
import type { PendingSlotKind } from "@/lib/denis/platform/pending-slot-types";

export type { PendingSlotKind };

export type ConversationAwaiting =
  | PendingSlotKind
  | "confirm"
  | "browse_decision"
  | "recommendation_pick"
  | "clarify_intent"
  | null;

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
  const matches = graph.beliefs.filter((entry) => entry.key === key);
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

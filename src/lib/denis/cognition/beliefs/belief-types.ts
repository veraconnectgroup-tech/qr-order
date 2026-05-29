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
  commercePendingSlot: "commerce.pending_slot",
  venueRush: "venue.rush",
  venueSkipUpsell: "venue.skip_upsell",
  guestReturnVisit: "guest.return_visit",
  policyRequireConfirm: "policy.require_confirm",
} as const;

export type ConversationMode = "banter" | "ordering" | "settling";

export type PendingSlotKind =
  | "serve_size"
  | "modifier"
  | "product"
  | "payment_method";

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

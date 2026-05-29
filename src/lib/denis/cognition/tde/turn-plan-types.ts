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
  commercePendingSlot: "commerce.pending_slot",
  venueRush: "venue.rush",
  venueSkipUpsell: "venue.skip_upsell",
  guestReturnVisit: "guest.return_visit",
  policyRequireConfirm: "policy.require_confirm",
} as const;

export type ConversationMode = "banter" | "ordering" | "settling";

export type PendingSlotKind = "serve_size" | "modifier" | "product" | "payment_method";

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

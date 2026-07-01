import {
  CORE_BELIEF_KEYS,
  getBeliefValue,
  type BeliefGraph,
} from "@/lib/denis/cognition/tde/turn-plan-types";

/** Rough token estimate (~4 chars/token). */
export function estimateContextTokens(text: string): number {
  return Math.max(1, Math.ceil(text.trim().length / 4));
}

export type TurnComplexity = "simple" | "moderate" | "complex";

const SIMPLE_ACK =
  /^(da|ne|ok|ja|yes|no|može|ajde|super|hvala|thanks|bitte|ok|jep|nope)[!.?]*$/i;

const GROUP_ORDER =
  /\b(za\s+sve|for\s+everyone|group|grupa|svima|party\s+of|za\s+cijeli\s+stol|group\s+order)\b/i;

const MULTI_ITEM =
  /\b\d+\s*[x×]\s*\w|\bi\s+\d+|\band\b|\bplus\b|\bte\s+još\b|\bund\b/i;

/** Classify turn complexity for adaptive context budget. */
export function estimateTurnComplexity(
  guestMessage: string,
  beliefs?: BeliefGraph
): TurnComplexity {
  const trimmed = guestMessage.trim();
  if (!trimmed) return "simple";

  if (SIMPLE_ACK.test(trimmed) && trimmed.length <= 14) return "simple";

  if (GROUP_ORDER.test(trimmed)) return "complex";
  if (trimmed.split(/[,;]/).filter((part) => part.trim()).length >= 3) {
    return "complex";
  }
  if (MULTI_ITEM.test(trimmed) && trimmed.length > 40) return "complex";

  const pendingSlot = beliefs
    ? getBeliefValue<string>(beliefs, CORE_BELIEF_KEYS.commercePendingSlot)
    : null;
  if (pendingSlot && SIMPLE_ACK.test(trimmed)) return "simple";

  if (trimmed.length <= 24 && !/\?/.test(trimmed)) return "simple";
  if (trimmed.length > 80 || (/\?/.test(trimmed) && trimmed.length > 50)) {
    return "complex";
  }

  return "moderate";
}

export const CONTEXT_BUDGET_BY_COMPLEXITY: Record<TurnComplexity, number> = {
  simple: 500,
  moderate: 1500,
  complex: 4000,
};

export type AdaptiveContextBudget = {
  tokenBudget: number;
  complexity: TurnComplexity;
  ceiling: number;
};

/** Resolve per-turn context token budget (adaptive or fixed ceiling). */
export function resolveAdaptiveContextBudget(input: {
  guestMessage: string;
  maxContextTokens: number;
  minContextTokens?: number;
  adaptiveEnabled?: boolean;
  beliefs?: BeliefGraph;
}): AdaptiveContextBudget {
  const ceiling = input.maxContextTokens;
  const min = input.minContextTokens ?? 500;
  const adaptive = input.adaptiveEnabled !== false;

  if (!adaptive) {
    return { tokenBudget: ceiling, complexity: "moderate", ceiling };
  }

  const complexity = estimateTurnComplexity(input.guestMessage, input.beliefs);
  const target = CONTEXT_BUDGET_BY_COMPLEXITY[complexity];
  const tokenBudget = Math.min(ceiling, Math.max(min, target));

  return { tokenBudget, complexity, ceiling };
}

const TWO_MIN_MS = 2 * 60_000;
const TEN_MIN_MS = 10 * 60_000;

/**
 * Freshness score for context age — 1.0 at ≤2 min, 0.5 at ≥10 min, linear between.
 */
export function scoreContextFreshness(ageMs: number): number {
  if (ageMs <= TWO_MIN_MS) return 1.0;
  if (ageMs >= TEN_MIN_MS) return 0.5;
  const ratio = (ageMs - TWO_MIN_MS) / (TEN_MIN_MS - TWO_MIN_MS);
  return 1.0 - ratio * 0.5;
}

/** Which priority tiers fit in a given token budget. */
export function resolveIncludedPriorities(
  tokenBudget: number
): Array<"P0" | "P1" | "P2" | "P3"> {
  if (tokenBudget >= 2000) return ["P0", "P1", "P2"];
  if (tokenBudget >= 1000) return ["P0", "P1"];
  return ["P0"];
}

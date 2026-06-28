import type { BeliefDecayConfig } from "@/lib/denis/kernel/beliefs/belief-decay-config";
import { DEFAULT_BELIEF_DECAY_CONFIG } from "@/lib/denis/kernel/beliefs/belief-decay-config";

export type BeliefCategory =
  | "allergies"
  | "intent"
  | "language"
  | "preference"
  | "default";

export type BeliefConflictLog = {
  key: string;
  winnerValue: unknown;
  winnerSource: string;
  winnerConfidence: number;
  rejected: Array<{
    value: unknown;
    source: string;
    confidence: number;
  }>;
  resolvedAtMs: number;
};

export type BeliefHistoryEntry = {
  atMs: number;
  key: string;
  value: unknown;
  confidence: number;
  source: string;
  event: "observed" | "decayed" | "reinforced" | "propagated" | "conflict_resolved";
};

export function beliefCategoryForKey(key: string): BeliefCategory {
  if (key.includes("allerg") || key === "guest.allergies") {
    return "allergies";
  }
  if (key.includes("intent") || key === "guest.lastUserIntent") {
    return "intent";
  }
  if (key.includes("language") || key === "guest.language") {
    return "language";
  }
  if (
    key.startsWith("mental.") ||
    key.startsWith("offer.") ||
    key.includes("preference")
  ) {
    return "preference";
  }
  return "default";
}

/** confidence *= max(min, 1 - elapsed/window) — allergies window is Infinity (no decay). */
export function computeDecayedConfidence(
  baseConfidence: number,
  observedAtMs: number,
  nowMs: number,
  category: BeliefCategory,
  config: BeliefDecayConfig = DEFAULT_BELIEF_DECAY_CONFIG
): number {
  const windowMs = config.decayWindowsMs[category];
  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    return baseConfidence;
  }

  const elapsedMs = Math.max(0, nowMs - observedAtMs);
  const factor = Math.max(config.minConfidence, 1 - elapsedMs / windowMs);
  const decayed = baseConfidence * factor;
  return Math.max(config.minConfidence, Math.min(1, decayed));
}

export function reinforceBeliefConfidence(
  existingConfidence: number,
  sameValue: boolean
): number {
  if (!sameValue) return existingConfidence;
  return 1;
}

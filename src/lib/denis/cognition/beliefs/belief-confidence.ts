import type { BeliefDecayConfig } from "@/lib/denis/kernel/beliefs/belief-decay-config";
import { DEFAULT_BELIEF_DECAY_CONFIG } from "@/lib/denis/kernel/beliefs/belief-decay-config";
import {
  beliefCategoryForKey as kernelBeliefCategoryForKey,
  computeDecayedConfidence,
  reinforceBeliefConfidence,
  type BeliefCategory,
  type BeliefConflictLog,
  type BeliefHistoryEntry,
} from "@/lib/denis/kernel/beliefs/belief-confidence-core";
import type { Belief, BeliefGraph, BeliefSource } from "@/lib/denis/cognition/beliefs/belief-types";
import { CORE_BELIEF_KEYS, belief, beliefGraph } from "@/lib/denis/cognition/beliefs/belief-types";

export type { BeliefCategory, BeliefConflictLog, BeliefHistoryEntry };

const SOURCE_PRIORITY: Record<string, number> = {
  explicit: 5,
  guest_said: 5,
  guest_tapped: 4,
  inferred: 3,
  system_inferred: 3,
  memory: 2,
  ops: 2,
  order_core: 2,
  menu_catalog: 2,
  staff_ops: 2,
  default: 1,
  config: 1,
};

function sourcePriority(source: string): number {
  return SOURCE_PRIORITY[source] ?? 2;
}

export function beliefCategoryForKey(key: string): BeliefCategory {
  if (key === CORE_BELIEF_KEYS.guestAllergies) return "allergies";
  if (key === CORE_BELIEF_KEYS.mentalIntent) return "intent";
  if (key === CORE_BELIEF_KEYS.conversationLanguage) return "language";
  return kernelBeliefCategoryForKey(key);
}

export { computeDecayedConfidence, reinforceBeliefConfidence };

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Latest explicit > older inferred > system default. */
export function resolveBeliefConflicts<T extends Belief>(
  beliefs: T[],
  conflictLog?: BeliefConflictLog[],
  nowMs = Date.now()
): T[] {
  const byKey = new Map<string, T[]>();
  for (const entry of beliefs) {
    const list = byKey.get(entry.key) ?? [];
    list.push(entry);
    byKey.set(entry.key, list);
  }

  const resolved: T[] = [];

  for (const [key, candidates] of byKey) {
    if (candidates.length === 1) {
      resolved.push(candidates[0]!);
      continue;
    }

    const sorted = [...candidates].sort((a, b) => {
      const priorityDiff = sourcePriority(b.source) - sourcePriority(a.source);
      if (priorityDiff !== 0) return priorityDiff;
      const aAt = a.observedAtMs ?? 0;
      const bAt = b.observedAtMs ?? 0;
      return bAt - aAt;
    });

    const winner = sorted[0]!;
    const losers = sorted.slice(1);

    if (conflictLog && losers.length > 0) {
      conflictLog.push({
        key,
        winnerValue: winner.value,
        winnerSource: winner.source,
        winnerConfidence: winner.confidence,
        rejected: losers.map((row) => ({
          value: row.value,
          source: row.source,
          confidence: row.confidence,
        })),
        resolvedAtMs: nowMs,
      });
    }

    resolved.push(winner);
  }

  return resolved;
}

export function propagateBeliefs(
  beliefs: Belief[],
  conflictLog?: BeliefConflictLog[],
  nowMs = Date.now()
): Belief[] {
  const propagated: Belief[] = [...beliefs];
  const find = (key: string) => beliefs.find((row) => row.key === key);

  const allergies = find(CORE_BELIEF_KEYS.guestAllergies);
  const allergyValues = Array.isArray(allergies?.value)
    ? (allergies!.value as string[])
    : [];
  if (allergyValues.includes("gluten")) {
    propagated.push(
      belief(
        CORE_BELIEF_KEYS.menuFilter,
        "no_gluten",
        "inferred",
        allergies?.confidence ?? 0.9,
        {
          observedAtMs: allergies?.observedAtMs ?? nowMs,
          propagatedFrom: CORE_BELIEF_KEYS.guestAllergies,
        }
      )
    );
  }

  const mode = find(CORE_BELIEF_KEYS.conversationMode);
  if (mode?.value === "settling") {
    const skip = find(CORE_BELIEF_KEYS.venueSkipUpsell);
    propagated.push(
      belief(
        CORE_BELIEF_KEYS.venueSkipUpsell,
        true,
        "inferred",
        Math.max(skip?.confidence ?? 0.85, mode.confidence),
        {
          observedAtMs: mode.observedAtMs ?? nowMs,
          propagatedFrom: CORE_BELIEF_KEYS.conversationMode,
        }
      )
    );
  }

  const language = find(CORE_BELIEF_KEYS.conversationLanguage);
  if (language?.value === "sr" || language?.value === "hr") {
    propagated.push(
      belief(
        CORE_BELIEF_KEYS.conversationTon,
        "casual",
        "inferred",
        language.confidence,
        {
          observedAtMs: language.observedAtMs ?? nowMs,
          propagatedFrom: CORE_BELIEF_KEYS.conversationLanguage,
        }
      )
    );
  }

  return resolveBeliefConflicts(propagated, conflictLog, nowMs);
}

export function applyBeliefDecay(
  beliefs: Belief[],
  observedAtMap: Record<string, number>,
  nowMs: number,
  config: BeliefDecayConfig = DEFAULT_BELIEF_DECAY_CONFIG
): Belief[] {
  return beliefs.map((entry) => {
    const observedAtMs = entry.observedAtMs ?? observedAtMap[entry.key] ?? nowMs;
    const category = beliefCategoryForKey(entry.key);
    const decayed = computeDecayedConfidence(
      entry.confidence,
      observedAtMs,
      nowMs,
      category,
      config
    );
    if (decayed === entry.confidence) return entry;
    return { ...entry, confidence: decayed, observedAtMs };
  });
}

export type BeliefConfidencePipelineInput = {
  graph: BeliefGraph;
  nowMs?: number;
  observedAtMap?: Record<string, number>;
  decayConfig?: BeliefDecayConfig;
  conflictLog?: BeliefConflictLog[];
};

/** Decay → conflict resolution → propagation (ADR-023 belief confidence). */
export function applyBeliefConfidencePipeline(
  input: BeliefConfidencePipelineInput
): BeliefGraph {
  const nowMs = input.nowMs ?? Date.now();
  const observedAtMap = input.observedAtMap ?? {};
  const decayConfig = input.decayConfig ?? DEFAULT_BELIEF_DECAY_CONFIG;

  const decayed = applyBeliefDecay(
    input.graph.beliefs,
    observedAtMap,
    nowMs,
    decayConfig
  );
  const resolved = resolveBeliefConflicts(
    decayed,
    input.conflictLog,
    nowMs
  );
  const propagated = propagateBeliefs(
    resolved,
    input.conflictLog,
    nowMs
  );

  return beliefGraph(propagated);
}

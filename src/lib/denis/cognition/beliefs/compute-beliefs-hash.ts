import { createHash } from "node:crypto";
import type { BeliefGraph } from "@/lib/denis/cognition/beliefs/belief-types";

function stableSerialize(value: unknown): string {
  return JSON.stringify(value, (_key, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.keys(v as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = (v as Record<string, unknown>)[key];
          return acc;
        }, {});
    }
    return v;
  });
}

/** Deterministic hash for timeline idempotency + enterprise replay (ADR-023 §3.2). */
export function computeBeliefsHash(graph: BeliefGraph): string {
  const payload = graph.beliefs
    .map((entry) => ({
      key: entry.key,
      value: entry.value,
      confidence: entry.confidence,
      source: entry.source,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  return createHash("sha256").update(stableSerialize(payload)).digest("hex");
}

/** Compact key→value map for timeline payload (not full graph). */
export function summarizeBeliefGraph(graph: BeliefGraph): Record<string, unknown> {
  const summary: Record<string, unknown> = {};
  for (const entry of graph.beliefs) {
    summary[entry.key] = entry.value;
  }
  return summary;
}

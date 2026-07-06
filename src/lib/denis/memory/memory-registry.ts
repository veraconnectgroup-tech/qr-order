/**
 * Denis Memory Registry (ADR-045 §4.1) — declares which memory tier each
 * store belongs to, instead of scattering that judgment across call sites.
 * Pure, read-only config — no DB access, no runtime state (commit-checklist
 * §4: in-memory state is a bug on serverless).
 *
 * SCOPE NOTE: ADR-045's S1 session calls for inventorying every
 * Denis-relevant table across the whole app (station truth, rhythm priors,
 * outcome learning, audit journals, etc.) — a large, separate initiative
 * with its own session-prompt tracking (docs/architecture/ADR-045-session-prompts.md).
 * This file seeds the registry with the one table this station-voice
 * work actually touches; it does not claim full ADR-045 S1 coverage.
 * Extending coverage to the rest of the app is that session's job, not this one.
 */

export type MemoryTier = "live" | "shift" | "restaurant" | "audit";

export type DayCloseBehavior = "close" | "rollup" | "keep" | "delete" | "anonymize";

export type MemoryRegistryEntry = {
  table: string;
  tier: MemoryTier;
  /** Days after which this tier's data should be swept. null = indefinite (audit). */
  retentionDays: number | null;
  dayClose: DayCloseBehavior;
  pii: boolean;
  notes: string;
};

const MEMORY_REGISTRY: readonly MemoryRegistryEntry[] = [
  {
    table: "station_question_turns",
    tier: "shift",
    retentionDays: 1,
    dayClose: "close",
    pii: false,
    notes:
      "Per-question voice conversation log (kitchen/bar). Only meaningful for the shift it happened in — discarded once the question resolves/expires or the shift closes, never carried into the next day.",
  },
];

export function getMemoryLevel(table: string): MemoryTier | null {
  return MEMORY_REGISTRY.find((entry) => entry.table === table)?.tier ?? null;
}

export function entriesForDayClose(): MemoryRegistryEntry[] {
  return MEMORY_REGISTRY.filter((entry) => entry.dayClose !== "keep");
}

/** Entries whose declared retention window applies for a sweep — audit entries (retentionDays: null) are always excluded. */
export function entriesWithExpiredRetention(): MemoryRegistryEntry[] {
  return MEMORY_REGISTRY.filter(
    (entry) => entry.tier !== "audit" && entry.retentionDays != null
  );
}

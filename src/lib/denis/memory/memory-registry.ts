/**
 * Denis Memory Registry (ADR-045 §4.1) — declares which memory tier each
 * store belongs to, instead of scattering that judgment across call sites.
 * Pure, read-only config — no DB access, no runtime state (commit-checklist
 * §4: in-memory state is a bug on serverless).
 *
 * ADR-045 S1 coverage: every table under src/lib/denis/** that accumulates
 * over time and needs a tier/retention/PII judgment is registered here.
 * Deliberately excluded (by ADR-045 §6 anti-goal — no scope creep):
 * - Core commerce tables with their own lifecycle (orders, order_items,
 *   table_sessions, commerce_preorders) — not "memory" in ADR-045's sense.
 * - Org/billing ledgers (ai_credits, org_billing_events, ...) — financial
 *   infrastructure, correctly permanent, not conversational/operational memory.
 * - Pure computed/derived state with no dedicated table (fold/session state,
 *   copilot snapshots, watcher state, anti-spam cooldowns — all folded live
 *   from other already-registered tables, e.g. denis_timeline).
 * - denis_ab_experiments / denis_ab_session_assignments — product
 *   experimentation lifecycle, not memory tiering.
 * - Guest personal memory (denis_guest_memory, guest_loyalty_profiles, ...)
 *   — ADR-045 §2 explicitly keeps this OUT of the 4-tier model ("device-bound
 *   guest memory, never Restaurant tier"). It has its own expires_at/opt-out
 *   mechanism (src/lib/guest/denis-guest-memory-store.ts), swept via
 *   sweepExpiredGuestMemory() in memory-retention.ts's cron sweep — not
 *   registered here since it's outside the 4-tier model, not because it's
 *   unswept.
 * - denis_relationship_signals — migrated but genuinely dead code, nothing
 *   reads or writes it. Left idle, not registered.
 *
 * Known open gap, not a bug to silently fix: denis_timeline has no retention
 * policy anywhere (not even a declared-but-unenforced one) despite being the
 * backbone of the eval flywheel and carrying guest-turn-derived payloads.
 * Registered below with retentionDays: null and dayClose: "keep" — an
 * honest "not yet decided" rather than an invented policy, since any sweep
 * here needs an explicit call on how long the flywheel/audit trail needs it.
 */

export type MemoryTier = "live" | "shift" | "restaurant" | "audit";

export type DayCloseBehavior = "close" | "rollup" | "keep" | "delete" | "anonymize";

export type MemoryRegistryEntry = {
  table: string;
  tier: MemoryTier;
  /** Days after which this tier's data should be swept. null = indefinite (audit) or not yet decided (see notes). */
  retentionDays: number | null;
  dayClose: DayCloseBehavior;
  pii: boolean;
  notes: string;
};

const MEMORY_REGISTRY: readonly MemoryRegistryEntry[] = [
  // --- shift tier: open -> Day Close ---
  {
    table: "station_questions",
    tier: "shift",
    retentionDays: 1,
    dayClose: "close",
    pii: false,
    notes:
      "Per-station open question tracker (kitchen/bar ETA asks). Open rows past shift end should never carry into the next day — Day Close expires them (status -> 'expired', reason 'day_close'), the same status transition normal SLA TTL expiry already uses.",
  },
  {
    table: "station_question_turns",
    tier: "shift",
    retentionDays: 1,
    dayClose: "close",
    pii: false,
    notes:
      "Per-question voice conversation log (kitchen/bar). Only meaningful for the shift it happened in. Wired in day-close.ts via expireStationQuestionTurns() — deletes turns older than retentionDays for this location's questions.",
  },
  {
    table: "table_bus_obligations",
    tier: "shift",
    retentionDays: 1,
    dayClose: "close",
    pii: false,
    notes:
      "Waiter 'bus this table' obligation after payment (paid_at -> bussed_at). Same-service lifecycle as station_questions — Day Close cancels open rows (status -> 'cancelled').",
  },
  {
    table: "denis_staff_table_hints",
    tier: "shift",
    retentionDays: 1,
    dayClose: "delete",
    pii: true,
    notes:
      "Free-text staff note pinned to a table — the ADR's own canonical example ('table 8 is nervous'). Day Close deletes all active hints for the location (shift-tier, no cross-day carry).",
  },
  {
    table: "waiter_calls",
    tier: "shift",
    retentionDays: 1,
    dayClose: "close",
    pii: false,
    notes:
      "Guest-initiated waiter call. Same-service signal, no cross-day meaning. Day Close resolves pending/acknowledged calls.",
  },
  {
    table: "denis_schedules",
    tier: "shift",
    retentionDays: 1,
    dayClose: "delete",
    pii: false,
    notes:
      "Anticipation job queue (e.g. dessert-nudge wake). Day Close cancels pending/processing rows and purges completed/cancelled rows for the location.",
  },
  {
    table: "denis_timeline",
    tier: "shift",
    retentionDays: 90,
    dayClose: "keep",
    pii: true,
    notes:
      "Append-only per-session event log. 90-day retention balances eval flywheel needs (ADR-019 continuous eval) with GDPR shift-tier cleanup — Day Close keeps rows (rollup reads today); retention job deletes events older than 90 days.",
  },

  // --- restaurant tier: permanent, restaurant-level, never personal ---
  {
    table: "location_rhythm_priors",
    tier: "restaurant",
    retentionDays: null,
    dayClose: "keep",
    pii: false,
    notes:
      "ADR-042 rhythm priors — one row per location, EWMA slot priors + learned_basket_pairs. Aggregates only, no raw guest data. Own rollup job (ADR-042) already maintains it; Day Close doesn't touch it.",
  },
  {
    table: "denis_learned_edges",
    tier: "restaurant",
    retentionDays: null,
    dayClose: "keep",
    pii: false,
    notes:
      "Admin-approval queue for VKG pairing candidates (edge_type: pairs_with = discovered pairing, upsell_after = ADR-039 nudge-outcome learning). Product-id pairs + stats only. Permanent until admin approves/rejects — correctly durable.",
  },
  {
    table: "experience_analytics_daily",
    tier: "restaurant",
    retentionDays: null,
    dayClose: "keep",
    pii: false,
    notes:
      "Daily rollup (one row per location+date): nudge impressions/conversions, session revenue, experience score. Aggregate only, accumulates by design.",
  },
  {
    table: "upsell_rules",
    tier: "restaurant",
    retentionDays: null,
    dayClose: "keep",
    pii: false,
    notes:
      "Active upsell rule config per location — the applied output of an approved denis_learned_edges row. Config, not a log.",
  },
  {
    table: "denis_restaurant_knowledge",
    tier: "restaurant",
    retentionDays: null,
    dayClose: "keep",
    pii: true,
    notes:
      "Owner/staff-authored free-text house knowledge (rules, facts, style) — the one Restaurant-tier thing that has to be typed or said by a human, not inferred from order data. Soft-deleted (archived_at), never hard-deleted by Day Close. Free text may name specific people — treat as PII.",
  },

  // --- audit tier: long-lived, never casually deleted ---
  {
    table: "order_events",
    tier: "audit",
    retentionDays: null,
    dayClose: "keep",
    pii: false,
    notes:
      "Order-level append-only mutation log. This IS the ADR-044 §4.1 'one journal' target (extension of this existing table, not a separate one). Intentionally permanent — GoBD.",
  },
  {
    table: "denis_day_closes",
    tier: "audit",
    retentionDays: null,
    dayClose: "keep",
    pii: false,
    notes:
      "Idempotency + proof record for each location's Day Close run. This table IS the audit record of ADR-045 S2 itself.",
  },
  {
    table: "denis_audit_entries",
    tier: "audit",
    retentionDays: 365,
    dayClose: "keep",
    pii: true,
    notes:
      "Denis per-turn compliance audit journal — writer wired in run-denis-turn.ts via persistDenisAuditEntry(). Guest input is SHA-256 hashed; allergy rows retain 180d, others 30d per auditRetentionDays().",
  },
  {
    table: "commerce_experience_events",
    tier: "audit",
    retentionDays: null,
    dayClose: "keep",
    pii: false,
    notes:
      "ADR-014 commerce spine command/event log, append-only outbox-style. Feeds experience_analytics_daily rollup.",
  },
  {
    table: "ai_order_events",
    tier: "audit",
    retentionDays: null,
    dayClose: "keep",
    pii: false,
    notes:
      "Per-AI-session order lifecycle log (draft_updated, submit_requested, order_created, ...). Audit trail for the AI ordering flow specifically.",
  },

  // --- live tier: seconds-minutes, already enforced elsewhere ---
  {
    table: "denis_turn_traces",
    tier: "live",
    retentionDays: 7,
    dayClose: "keep",
    pii: true,
    notes:
      "Full per-turn execution trace (tier, tokens, latency) — GDPR-sensitive per its own code comment. Already deleted on a 7-day cron in src/app/api/cron/cleanup/route.ts (DATA_RETENTION.turnTraces). Registered here for completeness only — Day Close does not duplicate this, the existing cron already owns it.",
  },
];

/** Exposed for the registry's own invariant tests only — not a runtime API. */
export const MEMORY_REGISTRY_FOR_TESTS = MEMORY_REGISTRY;

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

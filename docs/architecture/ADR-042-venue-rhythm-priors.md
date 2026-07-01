# ADR-042 — Venue Rhythm Priors (VRP)

| Field | Value |
|-------|--------|
| **Status** | **APPROVED** — **VRP-P0–P4** implemented (default `rhythm.mode=off`) |
| **Parent** | [ADR-019](./ADR-019-denis-unified-brain.md) · [ADR-020 §Kad](./ADR-020-denis-table-operating-system.md) · [ADR-039](./ADR-039-nudge-outcome-learning.md) · [ADR-040 UPDS](./ADR-040-unified-proactive-decision-spine.md) · [ADR-041 IJS](./ADR-041-intervention-journal-spine.md) · [ADR-014](./ADR-014-commerce-experience-platform.md) |
| **Pattern** | Learned **config artifact** + commerce rollup — not a third brain |

---

## 0. One sentence

**Venue rhythm is learned priors resolved into `ConciergeConfig` at load time**, updated incrementally from `commerce.session.completed` — parametrizing scheduler/UPDS **Kad (scheduled)** and staff prep, with admin heatmap/RevPASH **offline only**.

---

## 1. Problem

Fixed platform defaults (`dessertDelayMinutes: 20`, ad-hoc weekday SQL) ignore how each venue actually runs:

| Gap | Cost |
|-----|------|
| Dessert wake @ +20 min everywhere | Too early/late vs real guest behavior |
| `loadTopItemsForWeekday()` raw scan | Slow, wrong timezone, not incremental |
| No owner view of slot patterns | RevPASH, rush prep invisible |

**Rejected:** VTI warehouse (5 tables, `state.venue.temporal`, nightly RPC scan) — violates ADR-019/040.

---

## 2. Architecture

```
session.closed (settled)
        │
        ▼
commerce.session.completed
        │
   ┌────┴────┐
   ▼         ▼
location_rhythm_priors   experience_analytics_daily
(JSONB slot EWMA)        (sessions_closed, revenue)
        │
        ▼
loadConciergeConfig + loadRhythmRuntimeContext
        │
   ┌────┼────────────┬──────────────┐
   ▼    ▼            ▼              ▼
scheduler  proactive   staff prep    admin heatmap
(IJS wake) tick copy   daily push    RevPASH panel
```

**Guest fold unchanged.** No `state.venue.rhythm`. No SQL in FOLD.

---

## 3. Core types

### `location_rhythm_priors` (one row / location)

```typescript
priors.slots["dow:hour"] = {
  sampleSessions, confidence (computed at resolve),
  dessertDelayP50Min, sessionDurationP50Min, revenueEma,
  topProducts[], servicePeriod
}
```

### `ConciergeConfig.rhythm`

```typescript
rhythm: {
  enabled: boolean,
  mode: "off" | "shadow" | "enforce",
  minSampleSessions: 8,
  minConfidence: 0.4,
  ops: {
    rushAlerts: boolean,
    staffingHints: boolean,
    rushThreshold: 1.8,
    targetSessionsPerWaiter: 4,
    staffingOccupancyThreshold: 0.55,
  },
}
```

Ops alerts fire at **:30** local when the next-hour slot exceeds `rushThreshold × median`.

### Resolved at runtime (not stored in schema)

- `effectiveDessertDelayMinutes` — enforce → learned p50, else platform default
- `rhythmTopProductName` — enforce welcome copy
- `mental_model.gate.rhythm` — shadow/enforce audit block

---

## 4. Integration map

| ADR-020 | Module | VRP role |
|---------|--------|----------|
| **Kad (scheduled)** | `buildScheduleDrafts`, IJS `INTERVENTION_WAKE` | `effectiveDessertDelayMinutes` |
| **Kad (reactive)** | `computeOfferTiming` | **Unchanged** — browse clock |
| **Kako** | `buildWelcomeMessage`, `rankProactiveCandidates` | top product copy (enforce) |
| **Learn** | `rollup-venue-rhythm-priors` | EWMA on `session.completed` |
| **Owner** | `/admin/denis-insights` Venue rhythm panel | heatmap, RevPASH, comparative |
| **Staff** | `runProactiveDailyJobs` | slot top products for prep push |

---

## 5. Commerce events

| Event | Command | Rollup |
|-------|---------|--------|
| `session.completed` | `RecordSessionCompleted` | `location_rhythm_priors` + `experience_analytics_daily.sessions_closed` |

Idempotency: `vrp:session-completed:{sessionId}`.

---

## 6. Rollout

| Phase | Status | Guest impact |
|-------|--------|--------------|
| **P0** | ✅ | Shadow gate audit only |
| **P1** | ✅ | Enforce dessert scheduler delay |
| **P2** | ✅ | Prep push + welcome copy |
| **P3** | ✅ | Admin heatmap / RevPASH / comparative |
| **P4** | ✅ | Ops rush + staffing push (staff only) |

**Pilot:**

```json
"rhythm": { "enabled": true, "mode": "shadow" }
```

**Full enforce:**

```json
"rhythm": { "enabled": true, "mode": "enforce" }
```

---

## 7. Migrations

| # | Table / column |
|---|----------------|
| `00122` | `location_rhythm_priors` |
| `00123` | `experience_analytics_daily.sessions_closed`, `session_revenue_total` |

---

## 8. Tests

- `src/__tests__/denis-venue-rhythm-priors.test.ts`
- `src/__tests__/denis-scheduler.test.ts` (effective delay)
- `src/__tests__/commerce/session-daily-analytics.test.ts`

---

## 9. Deletion list

| Remove | Replaced by |
|--------|-------------|
| Raw `loadTopItemsForWeekday` SQL in daily jobs | `loadRhythmPrepTopProducts` (+ legacy fallback) |

---

## 10. Related

- [ADR-040 UPDS](./ADR-040-unified-proactive-decision-spine.md) — reactive Kad stays in offer fold
- [ADR-041 IJS](./ADR-041-intervention-journal-spine.md) — speak/silence; VRP parametrizes wake time only
- [ADR-039](./ADR-039-nudge-outcome-learning.md) — nudge learning separate from slot priors

# ADR-040 — Unified Proactive Decision Spine (UPDS)

| Field | Value |
|-------|--------|
| **Status** | **APPROVED** — architecture contract (implementation pending) |
| **Parent** | [ADR-019](./ADR-019-denis-unified-brain.md) · [ADR-038 GMM](./ADR-038-guest-mental-model.md) · [ADR-039](./ADR-039-nudge-outcome-learning.md) · [ADR-020 §Kad](./ADR-020-denis-table-operating-system.md) |
| **Rule** | One loop · one decider · one emitter · timing in offer fold · audit in `mental_model.gate` |

---

## 0. One sentence

**Proactive Denis is not a separate subsystem** — it is the same ADR-019 loop (`SIGNAL → FOLD → DECIDE → ACT`) where **Kad** (timing) lives in the offer fold, **Ko/Kako** in the GMM policy manifest, and every tick leaves an auditable decision trace — with **no dual brain**, **no moment catalog**, **no new DB tables**.

---

## 1. Problem

Today two proactive systems run in parallel:

| Path | Behaviour |
|------|-----------|
| **Legacy** (`mentalModel.mode: off`) | Minute triggers, `lib/ai/proactive-triggers`, scheduler direct emit |
| **Enterprise** (`enforce` + `offerEnrich`) | GMM rank → policy → offer readiness — but readiness uses wrong clock and contradicts policy |

Five gates answer the same question (`shouldOffer*` → enrich → policy → `upsellSuppressed` → commerce). Three code paths write `proactive.emitted`. Tests call `detectProactiveCandidate` while production calls `planProactiveTurn`.

**Enterprise requirement:** one deterministic decision, full audit (speak **and** silence), eval parity with production, learning keyed on timing — **without** adding orchestrators.

---

## 2. Rejected shapes

| Approach | Why rejected |
|----------|--------------|
| `GoldenMoment[]` catalog | Enum maintenance; no fold; no ADR-039 learning key |
| Kad Engine + Opportunity state machine | Third orchestrator beside rank/policy/plan |
| Intervention Platform + holdout DB | Duplicates timeline; violates ADR-019 Truth |
| `state.kad` / `state.timing` Mind slice | Timing belongs in **offer** fold, not new Mind surface |
| New `proactive.evaluated` event type | Extend existing `mental_model.gate` + `proactive.emitted` |
| Bandit priors / 7 crons | ADR-039 + M16 already exist |

---

## 3. Architecture

```
TRUTH (timeline + orders + browse telemetry)
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ FOLD (pure, 0 DB, 0 LLM)                                    │
│  foldGuestSignals (1×) → foldGuestMentalModel →             │
│  foldGuestOfferContext + computeOfferTiming()               │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ DECIDE — planProactiveTurn() ONLY                           │
│  P0 obligation → P1 generate → P2 enrich → P3 policy →    │
│  P4 TDE → P5 utterance                                      │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ ACT — emitProactiveNudge() ONLY                             │
│  gate (always) → emitted (if speak) → commerce → dock       │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
LEARN — ADR-039 fold → M16 / rollup / admin (offline)
```

**Ingress:** watcher, sense, scheduler → enqueue `system.proactive_tick` → same loop. **No direct timeline write outside `emitProactiveNudge`.**

---

## 4. Kad — `computeOfferTiming()` (offer fold)

Module: `src/lib/denis/cognition/offer/compute-offer-timing.ts`

| Input (already in fold) | Role |
|-------------------------|------|
| `browseSequence.lastViewAtMs` | **Primary clock** — `view_product` telemetry |
| `spine.actionTimestamps` | Secondary — chat + cart churn |
| `mental.pace`, `mental.mealStage` | Context only — **not** readiness veto |
| `cartLineCount`, `nowMs` | Commerce guard |

```typescript
type OfferTiming = {
  kind: "browse_pause" | "return_view" | "cart_hesitation" | "none";
  idleSinceBrowseSec: number;
  speakWindow: "open" | "closed";
  ready: boolean;
  reason: OfferReadinessReason; // backward compat for policy + enrich
};
```

`deriveOfferReadiness()` becomes a thin adapter: `timing → readiness`. **No second timing brain.**

### Invariants (eval + CI)

| ID | Invariant |
|----|-----------|
| **T1** | `predictedNeed === needs_help_choosing` must **not** alone set `ready: false` |
| **T2** | `browse_pause` uses **last `view_product`**, not chat idle |
| **T3** | No hard idle cutoff gap — window closes via policy (`pace_rushed`, budget), not orphaned `posture_ready` |
| **T4** | Dessert / bill timing uses `mealStage` + GMM, not `lib/ai` minute triggers in enforce mode |

---

## 5. Decide — `planProactiveTurn()` phases

| Phase | Responsibility | Forbidden in enforce |
|-------|----------------|------------------------|
| **P0** | `waiter_gap` / `attention_handoff` obligation override | — |
| **P1 Generate** | `rankProactiveCandidates` — scored candidate list | `shouldOffer*` gates |
| **P2 Enrich** | Offer copy, cart_recovery, drop generic browse | Readiness gate (→ P3) |
| **P3 Policy** | `applyProactivePolicy` manifest walk — **only gate** | Duplicate checks in rank/decide |
| **P4 TDE** | `decideProactiveTurnPlan` — commerce blocks, template tier | `upsellSuppressed` (duplicates policy) |
| **P5 Utterance** | Template / TDE, 0 tokens default | — |

**Generate** = what a waiter *could* say. **Gate** = whether Denis *may* say it now. **Timing** = whether the *moment* is open (fold input to P3).

### Enforce semantics (fixes)

| Today | UPDS |
|-------|------|
| `confidence < threshold` bypasses policy | **Silence** + gate `gmm.confidence_insufficient` |
| `offerEnrich: false` disables readiness policy | Pilot: `enforce` + `offerEnrich` **paired** per venue |
| Dual brain forever | Legacy path **deleted** after R3 rollout |

---

## 6. Act — single writer + audit

### Single emitter

`src/lib/denis/runtime/emit-proactive-nudge.ts` — **only** file allowed to append guest `proactive.emitted`.

| Source | UPDS |
|--------|------|
| `run-session-watcher` | fold → `emitProactiveNudge` |
| `run-denis-sense` | **Must** call `emitProactiveNudge` (no inline append) |
| `process-scheduler-tick` | Enqueue tick only — **no** direct emit |
| `emit-staff-proactive-alert` | Event type **`staff.proactive.alert`** (not guest learning fold) |

### Audit — extend `mental_model.gate` (no new event type)

Append on **every** proactive tick in `shadow` + `enforce`:

```typescript
{
  type: "mental_model.gate",
  mode, candidateKind, allow, reason, wouldBlock, enforced,
  // UPDS extensions:
  evaluationChain: Array<{ kind: string; allow: boolean; reason: string | null }>,
  timingKind: OfferTiming["kind"] | null,
  topRankedKind: string | null,
  selectedKind: string | null,
  source: "session.watcher" | "sense.proactive_tick",
  policyVersion: string, // hash of DEFAULT_PROACTIVE_POLICY manifest
}
```

- **Speak:** gate (`allow: true`) + `proactive.emitted` with `timingKind`, `offerHash`, `policyReason`
- **Silence:** gate (`allow: false`, full `evaluationChain`) — no `proactive.emitted`

---

## 7. Learn — ADR-039 (unchanged shape)

Add dimension to existing emit payload only:

```typescript
proactive.emitted.timingKind  // e.g. "browse_pause"
```

`fold-nudge-outcomes` / M16 / rollup consume `timingKind × kind × productId`. Holdout = `ConciergePlaybookVariant` + shadow diff (ADR-038 rollout). **No new learning engine.**

---

## 8. Forbidden (compliance grep — `PDS-*`)

| Rule | Enforcement |
|------|-------------|
| **PDS-1** | `proactive.emitted` append only in `emit-proactive-nudge.ts` |
| **PDS-2** | `from @/lib/ai/proactive-triggers` banned in `src/lib/denis/cognition/` |
| **PDS-3** | `detectProactiveCandidate` banned outside migration window |
| **PDS-4** | `foldGuestSignals` at most once per `fold-table-session-state` |
| **PDS-5** | Proactive tests must call `planProactiveTurn`, not legacy rank API |

Add to `src/lib/denis/architecture/compliance.ts` + `pnpm verify:denis`.

---

## 9. Deletion list (not optional)

| Artifact | Reason |
|----------|--------|
| `detectProactiveCandidate` | No policy; tests lie about prod |
| `evaluateGuestProactiveTick` | Legacy M11 |
| `detect-proactive-candidate.ts` | Misleading barrel |
| Inline emit in `run-denis-sense` | Duplicate without gate |
| Direct emit in `process-scheduler-tick` | Second brain; kind `dessert` ≠ `dessert_nudge` |
| `shouldOffer*` in rank (enforce) | Duplicates policy |
| `upsellSuppressed` in decide (enforce) | Duplicates policy |
| `gate-proactive-nudge.ts` re-export | Dead indirection |

Move trigger logic from `lib/ai/proactive-triggers.ts` → `cognition/proactive/triggers.ts`; `lib/ai` may re-export for compat until legacy path deleted.

---

## 10. Rollout

| Phase | Scope | Exit criteria |
|-------|-------|---------------|
| **R0** | UPDS code behind existing flags | T1–T4 eval green |
| **R1** | Pilot venue: `mentalModel.mode = enforce` + `offerEnrich = true` | 7d shadow gate audit (ADR-038 checklist) |
| **R2** | Shadow diff; `evaluationChain` in admin replay | False-block rate < 30% |
| **R3** | Default → enforce; **delete legacy path** | No `mode=off` proactive in prod |
| **R4** | ADR-039 L2 weights use `timingKind` | M16 promote via admin |

---

## 11. Implementation phases

| Phase | Deliverable |
|-------|-------------|
| **P1** | `computeOfferTiming` + invariants T1–T4 + failing tests on current code |
| **P2** | Wire offer fold; fix `deriveOfferReadiness` adapter; enforce paired flags |
| **P3** | Consolidate emit paths; extend gate payload; staff event type split |
| **P4** | Delete forbidden list; PDS grep; migrate tests to `planProactiveTurn` |
| **P5** | `timingKind` on emit; rollup column; eval parity suite |

One PR per phase. Each PR: `pnpm verify:denis` + `pnpm eval:denis` + `pnpm type-check`.

---

## 12. Eval scenarios (UPDS)

- `timing_needs_help_browse_pause_speaks` (T1)
- `timing_uses_view_product_clock` (T2)
- `enforce_low_confidence_silence` (not bypass)
- `scheduler_tick_no_direct_emit` (PDS-1)
- `staff_alert_excluded_from_nudge_outcomes`
- `gate_evaluation_chain_on_silence`
- `proactive_emitted_includes_timing_kind`

---

## 13. Reference files

| File | Role |
|------|------|
| `cognition/offer/compute-offer-timing.ts` | Kad fold (new) |
| `cognition/offer/fold-guest-offer-context.ts` | Offer + timing integration |
| `cognition/offer/derive-offer-readiness.ts` | Adapter → timing |
| `cognition/proactive/plan-proactive-turn.ts` | Sole decider |
| `cognition/proactive/pick-proactive-candidate.ts` | Generate → policy pick |
| `cognition/proactive/apply-proactive-policy.ts` | Sole gate (enforce) |
| `runtime/emit-proactive-nudge.ts` | Sole guest emitter |
| `runtime/run-session-watcher.ts` | Cron ingress |
| `runtime/run-denis-sense.ts` | Signal ingress |
| `cognition/offer/fold-nudge-outcomes.ts` | ADR-039 learning |
| `architecture/compliance.ts` | PDS grep rules |

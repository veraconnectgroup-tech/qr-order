# ADR-041 — Intervention Journal Spine (IJS)

| Field | Value |
|-------|--------|
| **Status** | **APPROVED** — **IJS-P0–P5** implemented (default `intervention.mode=off`) |
| **Parent** | [ADR-019](./ADR-019-denis-unified-brain.md) · [ADR-020 §Kad](./ADR-020-denis-table-operating-system.md) · [ADR-038 GMM](./ADR-038-guest-mental-model.md) · [ADR-039](./ADR-039-nudge-outcome-learning.md) · [ADR-040 UPDS](./ADR-040-unified-proactive-decision-spine.md) · [ADR-006](./ADR-006-denis-control-plane.md) · [ADR-014](./ADR-014-commerce-experience-platform.md) |
| **Pattern** | Same bounded-context split as [ADR-012](./ADR-012-fiscal-journal-spine.md) fiscal journal |

---

## 0. One sentence

**When Denis may speak is an append-only Intervention Journal per table session**, driven through the **Table Session Actor**, evaluated by **`runInterventionPipeline()`** (wrapping UPDS), with **sim-gated manifest promotion** — not a third timing brain, not minute crons, not magic weights.

---

## 1. Problem

Today proactive timing is split:

| Path | Issue |
|------|--------|
| UPDS (`planProactiveTurn`) | Reactive tick; correct decider, incomplete Kad |
| Scheduler (`buildScheduleDrafts`) | Fixed minute intents (`DESSERT_UPSELL @ +20min`) |
| Watcher cron | Polls tables; races with scheduler/sense |
| Silence | No commerce-grade decision record |

Enterprise needs: **one orchestrator**, **trajectory fold**, **versioned manifest**, **speak and silence in journal**, **actor serialization**, **venue sim before promote**.

---

## 2. Architecture

```
SIGNAL* → Table Session Actor (FIFO)
              │
              ▼
     runInterventionPipeline()
              │
    ┌─────────┼─────────┐
    ▼         ▼         ▼
 foldSessionTrajectory  InterventionManifest  ADR-006 risk
              │
              ▼
     decision: SPEAK | SILENCE | DEFER
              │
    ┌─────────┴─────────┐
    ▼                   ▼
intervention_journal   planProactiveTurn → emitProactiveNudge (UPDS)
(commerce spine)       (only on SPEAK + policy allow)
```

**Ingress rule (target):** cron/watcher **enqueue** `system.proactive_tick` to actor; actor calls pipeline. IJS-P0 wires shadow journal from `emitProactiveNudge` first.

---

## 3. Core types

### SessionTrajectory (fold output)

```typescript
type SessionTrajectory = {
  ordering: "accelerating" | "steady" | "stuck" | "completing";
  engagement: "hot" | "warm" | "lull" | "cold";
  meal: "pre" | "active" | "post" | "paying";
  interruptionRisk: number;
  opportunity: number;
  evidence: string[];
};
```

Human labels ("post-browse pause", "happy signal") are **projections** for admin replay, not primary types.

### InterventionManifest

Versioned rules: `when.trajectory + when.mental + when.offer` → `allow.kinds + riskClass + defer`.

Default version: `ijs-v1`. Hash stored on every gate/journal row.

### Intervention Journal (commerce spine)

| Event | Meaning |
|-------|---------|
| `intervention.evaluated` | Pipeline ran; snapshot trajectory + matched rules |
| `intervention.committed` | Speak executed (links to `proactive.emitted`) |
| `intervention.declined` | Conscious silence with reason |
| `intervention.expired` | Defer window closed without speak |
| `intervention.superseded` | New signal cancelled pending defer |

Existing `anticipation.nudge_emitted` / `anticipation.resolved` remain outcome spine (ADR-039).

---

## 4. Integration with UPDS

| Layer | Role |
|-------|------|
| `foldSessionTrajectory` | Kad fold — momentum, not moments |
| `evaluateInterventionManifest` | Eligibility before speak |
| `planProactiveTurn` | Unchanged — Ko/Kako + policy |
| `emitProactiveNudge` | Unchanged sole guest emitter |
| `mental_model.gate` | Extended with `ijs` block in later phase |

**Enforce mode:** pipeline may block emit when journal says `SILENCE` and manifest `enforceBlock: true`. Shadow mode: journal only, UPDS speaks as today.

---

## 5. Deletion list (later phases)

| Remove | Replace with |
|--------|--------------|
| `evaluateScheduledIntent` | `runInterventionPipeline` on wake |
| Minute `DESSERT_UPSELL` drafts | manifest rule + trajectory meal |
| Watcher direct eval paths | actor enqueue |
| `detectDessertTrigger` in enforce | trajectory + GMM mealStage (ADR-040 T4) |

---

## 6. Rollout

| Phase | Deliverable |
|-------|-------------|
| **IJS-P0** | Trajectory fold + manifest + shadow `intervention.evaluated` |
| **IJS-P1** | Actor enqueue; scheduler = defer only |
| **IJS-P2** | `intervention.declined` on all silence paths |
| **IJS-P3** | Enforce block + unified manifest promote |
| **IJS-P4** | Venue sim gate + chain KPIs |
| **IJS-P5** | Timeline defer fold → superseded / expired journal |

Config:

```typescript
intervention: {
  enabled: boolean,
  mode: "off" | "shadow" | "enforce",  // default off
}
```

Paired with UPDS R1: `intervention.mode=enforce` requires `mentalModel.mode=enforce` + `offerEnrich=true`.

---

## 7. Eval scenarios (IJS-P0+)

- `trajectory_browse_stuck_needs_help`
- `manifest_browse_stuck_matches`
- `shadow_journal_on_speak_and_silence`
- `intervention_evaluated_includes_manifest_version`
- `no_second_proactive_emit_path`

---

## 8. Reference files

| File | Role |
|------|------|
| `cognition/intervention/fold-session-trajectory.ts` | Trajectory fold |
| `cognition/intervention/intervention-manifest-defaults.ts` | `ijs-v1` |
| `cognition/intervention/evaluate-intervention-manifest.ts` | Rule match |
| `cognition/intervention/run-intervention-pipeline.ts` | Pure evaluate + journal payload |
| `runtime/run-intervention-pipeline.ts` | Async commerce record (P0) |
| `commerce/project-intervention-journal.ts` | Spine projection |
| `runtime/emit-proactive-nudge.ts` | Shadow wire (P0) |
| `cognition/intervention/extract-pending-intervention-from-timeline.ts` | Defer fold (P5) |
| `cognition/intervention/resolve-intervention-lifecycle-context.ts` | Supersede / expire (P5) |

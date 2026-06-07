# ADR-038 — Guest Mental Model (GMM)

| Field | Value |
|-------|--------|
| **Status** | APPROVED |
| **Parent** | [ADR-020 §Kad](./ADR-020-denis-table-operating-system.md) · [ADR-019](./ADR-019-denis-unified-brain.md) Phase A fold |
| **Child** | [ADR-040 UPDS](./ADR-040-unified-proactive-decision-spine.md) — timing + single emit path (supersedes dual-brain notes below when implemented) |
| **Replaces** | Vremenski proactive triggeri (`browseNudgeMinutes`, `popularityBrowseMinutes`, …) kao primarni signal |
| **Rule** | GMM-1 → GMM-8 shipped. `pnpm eval:denis` + `pnpm verify:denis` PASS. Rollout via `mentalModel.mode`. |

---

## Problem

Denis proactive sistem danas radi na hardkodovanim minutama (*"gleda meni 3 min → nudge"*). Pravi konobar čita gosta: odlučio li je, u žurbi li je, otvoren li je za predlog, frustriran li je. To mora biti **deterministički fold** iz postojećeg `TableSessionState`, ne novi LLM/DB sloj.

---

## North star

**Guest Mental Model (GMM)** = operativni guest posture koji se **rebuild-uje na svakom fold-u** (<6ms eval SLA, 0 DB, 0 LLM). Koristi se za:

1. **Rank + policy** — svi kandidati, sortirani po `predictedNeed`, prvi koji prođe manifest
2. **Gate** — deny checks po kind-u (`DEFAULT_PROACTIVE_POLICY`)
3. **Routing** — kome se obraća (solo vs party leader)
4. **Urgency** — `needs_attention` → `attention_handoff` + ACL `handoff.waiter` kad `liveExecution`
5. **Observability** — `mental_model.updated` · `mental_model.gate` · `mental_model.diff`
6. **TDE beliefs** — `mental.*` keys u `compileBeliefs` (intent, receptiveness, frustration, predicted_need, price_affinity)

---

## Module layout (as-built)

```
src/lib/denis/cognition/mental-model/
├── mental-model-types.ts
├── fold-guest-mental-model.ts
├── fold-guest-signals.ts          # spine (Val A)
├── decline-state.ts
├── derive-intent.ts · derive-intent-transitions.ts
├── derive-pace.ts · derive-receptiveness.ts · derive-engagement.ts
├── derive-nudge-budget.ts · derive-meal-stage.ts · derive-price-affinity.ts
├── derive-group-dynamics.ts · derive-affect.ts   # frustration + sentiment merged
├── synthesize-predicted-need.ts
├── diff-mental-model.ts · mental-model-timeline.ts · append-mental-model-event.ts
├── gate-proactive-nudge.ts        # re-export → apply-proactive-policy
└── empty-mental-model.ts

src/lib/denis/cognition/proactive/
├── rank-proactive-candidates.ts   # GMM-6
├── pick-proactive-candidate.ts
├── proactive-policy-defaults.ts   # canonical manifest
├── apply-proactive-policy.ts
├── build-attention-handoff-message.ts  # GMM-7
└── …
```

---

## Rollout config

```ts
mentalModel: {
  enabled: boolean,              // legacy — see resolveMentalModelMode
  mode: "off" | "shadow" | "enforce",  // default "off"
  nudgeBudgetDefault: number,
  nudgeBudgetEnthusiastic: number,
  declineCooldownSeconds: number,
  frustrationEscalateThreshold: "mild" | "high",
  confidenceFallbackThreshold: number,  // enforce → legacy pick when confidence low
}
```

| Mode | Behaviour |
|------|-----------|
| `off` | Minute-based legacy pick (production default) |
| `shadow` | Legacy emit + `mental_model.gate` trace (`wouldBlock`) |
| `enforce` | Rank → policy → first allowed; low confidence falls back to legacy |

---

## Stubovi (delivered)

| Stub | Deliverable |
|------|-------------|
| **GMM-1** | types + fold + `state.mental` + eval |
| **GMM-2** | MealStage, PriceAffinity, PredictedNeed + gate + wire |
| **GMM-3** | Group dynamics + affect (frustration/sentiment) |
| **GMM-4** | Intent transitions + diff + timeline |
| **GMM-5** | Mental-first candidate + beliefs + minute fallback when off |
| **GMM-6** | Rank all → `DEFAULT_PROACTIVE_POLICY` → pick |
| **GMM-7** | `attention_handoff` + staff alert + ACL handoff on emit |
| **GMM-8** | `mental.price_affinity` belief + TDE suppress/routing |

---

## Acceptance (COMPLETE)

- [x] `state.mental` na svakom fold-u
- [x] `mental_model.updated` / `gate` / `diff` u timeline
- [x] Policy blokira closed / frustrated / rushed / budget popularity mismatch
- [x] `config.mentalModel.mode` rollout (`off` → `shadow` → `enforce`)
- [x] Eval ≥10 mental-model scenarija + gate suite PASS
- [x] Anticipation eval: closed guest nema browse_nudge (enforce)
- [x] `pnpm verify:denis` + `pnpm type-check` PASS
- [x] iota-style decline: `gmm_decline_cooldown_no_third` eval (2× decline → budget 0, gate deny)

---

## Shadow pilot checklist (pre-`enforce` on a location)

Operator — ručno na pilot lokaciji pre nego što `mentalModel.mode = enforce`:

- [ ] **7 dana `shadow`** — proveri `mental_model.gate` timeline: `wouldBlock` rate < 30% na proactive tickovima
- [ ] **False block audit** — 10 sesija gde shadow blokira; product potvrdi da bi i ručno ćutali
- [ ] **Attention path** — 1 frustriran sto: guest vidi `attention_handoff`, waiter_calls red up-to-date
- [ ] **No duplicate push** — isti sto ne dobija staff alert + waiter push dvaput u 5 min
- [ ] **Rollback** — `mode=off` za 1 sat, minute triggers rade kao pre

> **TODO (operator):** Označiti checklist na pilot lokaciji — nije automatizovano u CI.

---

## Šta NE raditi

- ❌ DB tabela za mental model
- ❌ LLM poziv za sentiment ili intent
- ❌ Dupli fold van `foldTableSessionState`
- ❌ Brisati minute-based triggere dok `mode = off`

---

## Reference

| Fajl | Uloga |
|------|-------|
| `loop/fold-table-session-state.ts` | Integracija fold-a |
| `cognition/proactive/pick-proactive-candidate.ts` | Rank → policy → pick |
| `cognition/proactive/plan-proactive-turn.ts` | Proactive orchestration |
| `runtime/emit-proactive-nudge.ts` | Emit + ACL attention handoff |
| `cognition/beliefs/compile-beliefs.ts` | mental.* beliefs |
| `cognition/tde/decide-turn-plan.ts` | TDE mental suppress + attention turn |

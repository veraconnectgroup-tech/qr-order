# ADR-038 — Guest Mental Model (GMM)

| Field | Value |
|-------|--------|
| **Status** | PROPOSED |
| **Parent** | [ADR-020 §Kad](./ADR-020-denis-table-operating-system.md) · [ADR-019](./ADR-019-denis-unified-brain.md) Phase A fold |
| **Replaces** | Vremenski proactive triggeri (`browseNudgeMinutes`, `popularityBrowseMinutes`, …) kao primarni signal |
| **Rule** | Jedan PR = jedan stub (GMM-1 → GMM-5). `pnpm eval:denis` + `pnpm verify:denis` PASS posle svakog. |

---

## Problem

Denis proactive sistem danas radi na hardkodovanim minutama (*"gleda meni 3 min → nudge"*). Pravi konobar čita gosta: odlučio li je, u žurbi li je, otvoren li je za predlog, frustriran li je. To mora biti **deterministički fold** iz postojećeg `TableSessionState`, ne novi LLM/DB sloj.

---

## North star

**Guest Mental Model (GMM)** = psihološki profil gosta koji se **rebuild-uje na svakom fold-u** (<5ms, 0 DB, 0 LLM). Koristi se za:

1. **Gate** — blokira/odobrava proactive nudge-ove
2. **Routing** — kome se obraća (solo vs party leader)
3. **Urgency** — frustration → pre waiter handoff-a
4. **Observability** — `mental_model.updated` + `mental_model.diff` u timeline

---

## Module layout

```
src/lib/denis/cognition/mental-model/
├── mental-model-types.ts          # sve dimenzije + enums
├── fold-guest-mental-model.ts     # pure fold (glavna funkcija)
├── derive-intent.ts               # Intent + transitions
├── derive-pace.ts
├── derive-receptiveness.ts
├── derive-price-affinity.ts
├── derive-meal-stage.ts
├── derive-engagement.ts
├── derive-nudge-budget.ts
├── derive-predicted-need.ts
├── derive-group-dynamics.ts       # party leader/follower
├── derive-frustration.ts
├── derive-micro-sentiment.ts
├── gate-proactive-nudge.ts        # gate API za detectProactiveCandidate
├── diff-mental-model.ts           # before/after + significant change
├── append-mental-model-event.ts   # timeline writer (poziva se posle fold-a)
└── empty-mental-model.ts
```

**Eval:**

```
src/lib/denis/eval/fixtures/mental-model/scenarios.ts
src/lib/denis/eval/run-mental-model-fixture.ts
```

---

## Tipovi (dimenzije)

| Dimenzija | Enum / shape | Izvor signala |
|-----------|--------------|---------------|
| **Intent** | `arrived` · `exploring` · `comparing` · `decided` · `ordering` · `waiting_food` · `eating` · `finishing` · `paying` | `SessionPhase`, `flowNodeId`, cart, orders, browse dwell pattern |
| **Pace** | `rushed` · `normal` · `relaxed` · `indecisive` | cart add/remove churn, message length, time-between-actions (iz timeline timestamps, ne wall-clock cron) |
| **Receptiveness** | `enthusiastic` · `open` · `neutral` · `polite_decline` · `closed` | guestAskedRecommendation, dismissed nudges, defer count, explicit "ne hvala" |
| **PriceAffinity** | `budget` · `mid` · `premium` · `unknown` | browse profile — category/product dwell; Phase 2: `priceBand` na browse ingest |
| **MealStage** | `pre_order` · `aperitif` · `main` · `between_courses` · `dessert_window` · `post_meal` · `paying` | orders (drink vs food vs dessert), delivered count, session phase |
| **Engagement** | `{ guestTurns, avgMsgLen, guestInitiated, nudgeResponseRate }` | `ConversationModel.thread`, `proactive.emitted` + sledeći guest reply |
| **NudgeBudget** | `{ remaining, max, cooldownUntil }` | start 3; enthusiastic → 5–7; closed → 0; 2× decline → cooldown 3min |
| **PredictedNeed** | `ready_to_order` · `needs_help_choosing` · `wants_drink` · `wants_dessert` · `wants_bill` · `needs_attention` · `none` | kombinacija Intent + MealStage + frustration + obligation gaps |
| **GroupDynamics** | `{ mode: solo\|party, leaderDevice?, followerDevices[], addressLeader }` | `TablePartyModel.devices` — first browse, first order, isPrimary |
| **Frustration** | `{ level: none\|mild\|high, signals[] }` | repeated message, CAPS, `???`, "dugo", "čekam", duplicate intent |
| **MicroSentiment** | `{ score: -1..1, lastSignals[] }` | pattern match na guest poruke (bez LLM) |
| **IntentTransitions** | `{ from, to, at, durationMs }[]` | diff između fold-ova; zadnjih 8 prelaza u modelu |

**Root type:** `GuestMentalModel` sa `version`, `computedAt`, `confidence` (0–1), `hash`.

---

## Fold integracija

### Gde

U `foldTableSessionState()` — **posle** `foldBrowseProfile` + `foldConversationModel` + `deriveFoldSessionPhase`, **pre** `mergeTableSessionObligation`.

### Šta

1. `mental = foldGuestMentalModel({ timeline, browse, conversation, commerce, party, session, phase, config, previousMental? })`
2. Dodaj `state.mental` na `TableSessionState` (novo polje u `loop/types.ts`)
3. Posle fold-a: `appendMentalModelUpdated` ako se hash promenio; `appendMentalModelDiff` ako significant change

### Pure fold contract

- Ulaz: samo podaci već u `TableSessionState` + opcioni `previousMental` iz poslednjeg `mental_model.updated` eventa u timeline (fold iz timeline, ne DB)
- Izlaz: `GuestMentalModel`
- SLA: <5ms na 500 timeline redova (benchmark u eval)

### Timeline eventi

| Event | Kada |
|-------|------|
| `mental_model.updated` | Svaki fold kad se `mental.hash` promeni |
| `mental_model.diff` | Kad `diffMentalModel` detektuje significant shift (intent, receptiveness, frustration high, nudgeBudget→0) |

Payload: `{ type, model, diff?, triggers: string[] }` — triggers = koji signal je izazvao (npr. `nudge_declined×2`, `intent:exploring→ordering`).

---

## Gate funkcije (proactive)

Nova funkcija: `gateProactiveNudge({ mental, candidate, config }) → { allow, reason }`

**Hard blocks (reason codes):**

| Reason | Uslov |
|--------|-------|
| `gmm.receptiveness_closed` | receptiveness = closed |
| `gmm.nudge_budget_zero` | remaining = 0 |
| `gmm.nudge_cooldown` | now < cooldownUntil |
| `gmm.intent_incompatible` | npr. dessert nudge dok intent = exploring |
| `gmm.frustration_high` | frustration high → samo `needs_attention` / waiter, ne upsell |
| `gmm.pace_rushed` | rushed → blokiraj browse_nudge, popularity_pair |
| `gmm.group_address_follower` | party follower device → ne šalji proactive (leader prima) |

**Soft allows:**

| Nudge kind | Zahteva |
|------------|---------|
| `guest_welcome` | intent = arrived, engagement.guestInitiated = false |
| `browse_nudge` | intent ∈ {exploring, comparing}, receptiveness ≥ open, predictedNeed = needs_help_choosing |
| `popularity_pair` | receptiveness ≥ open, priceAffinity match, nudgeBudget ≥ 1 |
| `dessert_nudge` | mealStage = dessert_window, receptiveness ≠ closed |
| `bill_prompt` | mealStage ∈ {post_meal, paying}, predictedNeed = wants_bill |
| `browse_follow_up` | guest explicitly deferred OR followUpRequestedAt — **ne** na minutama |

### Integracija u postojeći flow

```
planProactiveTurn()
  → detectProactiveCandidate()     # i dalje kandidat po vrsti
  → gateProactiveNudge(mental)     # NOVO — pre decideProactiveTurnPlan
  → decideProactiveTurnPlan()
```

`detectProactiveCandidate` **refaktor**: ukloni primarnu zavisnost od `browseMinutes` / `idleMinutes`; koristi `mental.intent`, `mental.predictedNeed`, `mental.mealStage`. Minuti ostaju samo kao **fallback** kad `config.mentalModel.enabled = false`.

`compileBeliefs`: dodaj `CORE_BELIEF_KEYS.mentalIntent`, `mentalReceptiveness`, `mentalFrustration`, `mentalPredictedNeed` — TDE može čitati bez ponovnog fold-a.

---

## Config flag

U `ConciergeProactiveSchema` (ili novi `ConciergeMentalModelSchema`):

```ts
mentalModel: {
  enabled: boolean,           // default false (rollout)
  nudgeBudgetDefault: number,   // 3
  nudgeBudgetEnthusiastic: number, // 6
  declineCooldownSeconds: number,  // 180
  frustrationEscalateThreshold: "mild" | "high",
}
```

Rollout: `config.mentalModel.enabled` + postojeći `config.rollout` slice po location.

---

## Stubovi (redosled PR-ova)

| Stub | Deliverable | Exit |
|------|-------------|------|
| **GMM-1** | types + `foldGuestMentalModel` (Intent, Pace, Receptiveness, Engagement, NudgeBudget) + `state.mental` + eval 5 scenarija | fold <5ms, eval PASS |
| **GMM-2** | MealStage, PriceAffinity, PredictedNeed + gate funkcija + wire u `planProactiveTurn` | anticipation eval: browse_nudge blokiran kad closed |
| **GMM-3** | Group dynamics + frustration + micro-sentiment | party scenario: follower ne dobija nudge |
| **GMM-4** | Intent transitions + diff logging + timeline eventi | timeline replay pokazuje diff na intent shift |
| **GMM-5** | `detectProactiveCandidate` refactor (mental-first) + beliefs keys + ukloni minute-fallback kad enabled | 40+ anticipation scenarija prošireno |

---

## Eval fixture (minimum 5 scenarija)

| ID | Setup | Expect |
|----|-------|--------|
| `gmm_arrived_welcome_ok` | 0 poruka, phase latent | intent=arrived, welcome gate allow |
| `gmm_exploring_browse_ok` | browse food 3 produkta, 0 cart | intent=exploring, browse_nudge allow |
| `gmm_closed_blocks_nudge` | 2× dismissed nudge + "ne hvala" | receptiveness=closed, nudgeBudget=0, gate deny |
| `gmm_frustrated_escalate` | "ČEKAM???", ponovljena poruka | frustration=high, predictedNeed=needs_attention |
| `gmm_party_leader_only` | 2 devicea, follower šalje poruku | addressLeader=true na primary, follower gate deny |
| `gmm_dessert_window` | order delivered, browsed desserts | mealStage=dessert_window, dessert allow |
| `gmm_indecisive_pace` | 4× add/remove isti produkt | pace=indecisive, popularity deny |

Runner: `pnpm eval:denis` uključuje `run-mental-model-fixture.ts`; pass rate ≥ 95%.

---

## Šta NE raditi

- ❌ DB tabela za mental model
- ❌ LLM poziv za sentiment ili intent
- ❌ Dupli fold van `foldTableSessionState`
- ❌ Menjati guest-visible copy u ovom ADR-u (samo gate + routing)
- ❌ Brisati minute-based triggere dok `mentalModel.enabled = false` (rollout safe)

---

## Reference (postojeći kod)

| Fajl | Uloga |
|------|-------|
| `loop/fold-table-session-state.ts` | Integracija fold-a |
| `cognition/proactive/detect-proactive-candidate.ts` | Refaktor triggera |
| `cognition/proactive/plan-proactive-turn.ts` | Gate hook |
| `cognition/proactive/decide-proactive-turn-plan.ts` | Phase guards (ostaje) |
| `cognition/browse/fold-browse-profile.ts` | Price affinity input |
| `cognition/conversation/fold-conversation-model.ts` | Engagement input |
| `cognition/proactive/session-watcher-context.ts` | Watcher payload → mental |
| `venue/party/types.ts` | Group dynamics |
| `loop/append-fold-completed.ts` | Obrazac za timeline event |

---

## Acceptance (ADR COMPLETE)

- [ ] `state.mental` na svakom fold-u
- [ ] `mental_model.updated` u timeline
- [ ] `gateProactiveNudge` blokira closed/frustrated/rushed
- [ ] `config.mentalModel.enabled` rollout flag
- [ ] Eval ≥7 scenarija PASS
- [ ] Anticipation eval: nema browse_nudge na closed guest
- [ ] `pnpm verify:denis` + `pnpm type-check` PASS
- [ ] iota pilot: gost odbije 2× → Denis ne šalje 3. nudge 3 min

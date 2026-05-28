# ADR-019 — Session Prompts (Denis Unified Brain)

> **Operator (Jovica):** koristi **[ADR-019-operator.md](./ADR-019-operator.md)** — jedna linija.  
> **Implement agent:** ovaj fajl + obavezna literatura ispod.

---

## Obavezna literatura (pročitaj PRE koda)

1. [ARCHITECTURE-INDEX.md](./ARCHITECTURE-INDEX.md) — §3 vocabulary, §4 gaps, §6 execution order
2. [ADR-019-denis-unified-brain.md](./ADR-019-denis-unified-brain.md) — loop, TableSessionState, phases
3. [ADR-020-denis-table-operating-system.md](./ADR-020-denis-table-operating-system.md) — §15 Truth·Mind·Face, §16 Actor, §17 ADR-013 absorption
4. [denis-implementation-map.md](./denis-implementation-map.md) — §3 as-built, §4 gaps, §7b phases
5. [.cursor/rules/commit-checklist.mdc](../../.cursor/rules/commit-checklist.mdc) — outbox, no duplicate side effects
6. [.cursor/rules/denis-architecture.mdc](../../.cursor/rules/denis-architecture.mdc) — layer boundaries

**Supabase:** ako diraš DB — [ADR-001-safe-rollout.md](./ADR-001-safe-rollout.md) + [supabase-migration-baseline.md](./supabase-migration-baseline.md).

---

## Status implementacije (ažuriraj posle svake sesije)

| Faza | Status | Ključni fajlovi / API |
|------|--------|------------------------|
| **A — FOLD** | ✅ | `src/lib/denis/loop/fold-table-session-state.ts` |
| **B — VIEW** | ✅ | `GET /api/denis/view`, `project-view.ts` |
| **C — SIGNAL** | ✅ | `POST /api/denis/signal`, thin wrappers |
| **D — WORLD** | ✅ | outbox → `commerce.*` signals → TELL + guest push |
| **E — ACTOR** | ✅ | queue/lock per `table_session_id`, view SSE |
| **F — TRUTH** | ✅ | transcript iz timeline; ai_sessions.messages read-only |

**As-built motor (ne diraj osim wire):** M0–M28 u `src/lib/denis/` — kernel, venue, runtime, acl, eval.

**Hibrid danas (retire u B–D):**

- Write: `/api/ai/chat`, `/api/denis/turn`, `/api/denis/sense`
- Read: `GET /api/guest/scene`, `ai_sessions`, Zustand cart, order poll
- `buildDenisTurnContext` + `load-scene-input` = **dva loadera** → Phase A spaja u FOLD

---

## Operator checklist (svaka sesija)

1. `git status` + diff — razumeti šta već postoji
2. **Tačno jedna faza** (ili jedan pod-korak unutar faze) — ne mega PR
3. Pre izmene funkcije: `grep -rn "functionName" src/`
4. Posle koda:

```bash
pnpm verify:denis
pnpm eval:denis      # obavezno ako diraš FOLD/DECIDE/kernel/runtime
pnpm type-check
pnpm lint
pnpm build
```

5. Session report (template u ADR-019-operator.md)
6. **Ne commit-uj** osim ako operator kaže

---

## Phase A — FOLD (Mind from TRUTH)

### Cilj

Denis **vidi celu situaciju stola** pre svake odluke — orders, cart, party, ops, timeline, memory.

### Implementacija

1. **Kreiraj** `src/lib/denis/loop/fold-table-session-state.ts`
   - Export: `foldTableSessionState(admin, input): Promise<TableSessionState>`
   - Tip: uskladi sa ADR-019 §4 (`TableSessionState`)
   - **Inputs (read-only):**
     - `denis_timeline` since session start
     - Order Core rows for `table_session_id`
     - Venue ops (`loadEffectiveVenueOps`)
     - Party (`loadTableParty`)
     - Guest memory (consented)
     - Cart: merge manual + ai draft (reuse adapters iz `runtime/adapters/`)
   - **Output metadata:** `truthHash` (hash ključnih inputa) za idempotency kasnije

2. **Kreiraj** `src/lib/denis/loop/types.ts` — `TableSessionState`, `FoldInput`, `FoldResult`

3. **Wire** u:
   - `runDenisTurn` — FOLD pre `planTurnWithReflex` / DECIDE
   - `runDenisSense` — FOLD pre proactive eval
   - `evaluate-proactive-tick` / server proactive path

4. **Refactor** `buildDenisTurnContext`:
   - Opcija A (prefer): context builder **poziva FOLD** i mapira u postojeći `DenisTurnContext` (minimal diff)
   - Opcija B: postepeno zameniti scattered loads — ali **orders moraju ući u FOLD**

5. **Timeline:** append `mind.fold_completed` sa `truthHash`, `orderCount`, `phase`

6. **Eval:** fixture u `src/lib/denis/eval/` — posle mock order submit, FOLD vidi order u `commerce.orders`

7. **Ne dodaj** nove guest API rute u Phase A

### grep acceptance

```bash
grep -rn "foldTableSessionState" src/lib/denis/
# mora: run-denis-turn, run-denis-sense, proactive path
```

### Ne raditi u Phase A

- `GET /api/denis/view`
- `POST /api/denis/signal`
- `runGuestExperiencePipeline`
- Novi orchestrator

---

## Phase B — VIEW (FACE)

### Cilj

Jedan guest read model — dock, transcript, cart, orders, chips iz **jednog** API-ja.

### Implementacija

1. `src/lib/denis/loop/project-view.ts` — `projectTableSessionView(state, tellResult): TableSessionView`
2. `GET /api/denis/view/route.ts` — auth via table session token
3. Persist: extend `guest_scene` + transcript blob **ili** nova `table_session_view` tabela (migration + RLS)
4. **Prva integracija:** order tracking page + dock headline čitaju view
5. `composeScene` / `load-scene-input` postepeno delegiraju na view projection

### Acceptance (ADR-019 §12 #1 partial)

Posle submit-a, view.transcript i view.orders usklađeni — bez posebnog chat fetch-a.

---

## Phase C — SIGNAL (write)

### Cilj

Svi guest intenti kroz `POST /api/denis/signal`.

### Implementacija

1. `src/app/api/denis/signal/route.ts`
2. `src/lib/denis/ingress/normalize-signal.ts`
3. Thin wrapper: postojeći chat/turn/sense → enqueue signal → run loop
4. **Ukloni** direktan guest poziv `/api/waiter-calls` — handoff preko signala → ACT
5. Network tab: waiter chip → samo `/api/denis/signal`

---

## Phase D — WORLD

### Cilj

Kuhinja / plaćanje budi Denisa — TELL + guest push bez guest pitanja.

### Implementacija

1. Outbox handleri: order status change → Denis signal `commerce.order_status` / `commerce.order_created`
2. Loop: FOLD → DECIDE → TELL → PROJECT → `project.notify` (guest push)
3. **Jedan tekst:** push body = dock headline = transcript line (isti TELL output)
4. Legacy route wrappers ostaju thin do kraja D, zatim delete plan

### Acceptance (ADR-019 §12)

- Test #1: order ready → push → transcript već ima liniju
- Test #2: Kellner rufen → nema waiter REST
- Test #4: rush → nema dessert chip

---

## Phase E — ACTOR + view stream

### Cilj

Serialized loop po stolu; realtime FACE bez poll-a.

### Implementacija

1. Signal queue per `table_session_id` (Redis stream ili PG — projekat već ima Upstash)
2. Distributed lock — jedan loop u isto vreme
3. `signalId` dedupe
4. Supabase Realtime / SSE na `table_session_view.version`
5. ADR-013 triggeri → samo signal types (v. ADR-020 §17)

---

## Phase F — Single TRUTH stream

### Cilj

Eliminisati drift između `denis_timeline` i `ai_sessions.messages`.

### Implementacija

1. Transcript u FACE = fold iz timeline (`tell.committed`, `signal.message`)
2. `ai_sessions.messages` — read-only legacy / deprecate write
3. Replay dispute = timeline + orders only

---

## Copy-paste promptovi po fazi

### Phase A

```
Denis brain Phase A (FOLD). Pročitaj ADR-019-session-prompts.md §Phase A + ADR-019 §4.
Implementiraj foldTableSessionState + wire u runDenisTurn, runDenisSense, proactive.
Dodaj mind.fold_completed timeline event + eval fixture (order visible in MIND).
Jedan PR scope. pnpm verify:denis && pnpm eval:denis && pnpm type-check && pnpm build.
Session report. Ne commit-uj.
```

### Phase B

```
Denis brain Phase B (VIEW). Pročitaj ADR-019-session-prompts.md §Phase B + ADR-019 §2.
Implementiraj GET /api/denis/view + project-view. Prva integracija: order page + dock.
pnpm verify:denis && pnpm type-check && pnpm build. Session report. Ne commit-uj.
```

### Phase C / D / E / F

```
Denis brain Phase [C|D|E|F]. Pročitaj ADR-019-session-prompts.md odgovarajući § + ARCHITECTURE-INDEX §6.
Jedan PR scope. Sva acceptance iz ADR-019 §12 za tu fazu. Ne commit-uj.
```

---

## Eksplicitne zabrane (ceo track)

- `runGuestExperiencePipeline` kao drugi mozak
- Guest UI → `create-order` / Order Core direktno
- Module-level `Map`/`Set` u `src/lib/denis/` za session state
- Dupli side effect (outbox + fire-and-forget za isti event)
- T3 odlučuje cart/submit
- Više od jedne faze po PR-u

---

## Reference code (postojeće — reuse)

| Šta | Gde |
|-----|-----|
| Turn entry | `src/lib/denis/runtime/run-denis-turn.ts` |
| Context loader (refactor) | `src/lib/denis/runtime/build-turn-context.ts` |
| Scene load (orders today) | `src/lib/scene/load-scene-input.ts` |
| Party | `src/lib/denis/venue/party/` |
| Ops | `src/lib/denis/venue/ops/` |
| Timeline | `src/lib/denis/platform/` |
| Act / ACL | `src/lib/denis/runtime/act/`, `src/lib/denis/acl/` |
| Eval | `src/lib/denis/eval/` |

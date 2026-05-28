# ADR-019 — Verification Checklist (review agent)

> **Za review agenta** koji proverava da li implement agent ispravno uradio fazu.  
> **Ne implementiraj** — samo grep, read, test, session report.

**Literatura:** [ADR-019](./ADR-019-denis-unified-brain.md) · [ADR-020 §15–§20](./ADR-020-denis-table-operating-system.md) · [ARCHITECTURE-INDEX](./ARCHITECTURE-INDEX.md)

---

## Global invariants (svaka faza)

| # | Provera | Kako |
|---|---------|------|
| G1 | Jedan PR = jedna faza | git log / diff scope |
| G2 | `pnpm verify:denis` PASS | pokreni |
| G3 | Nema novog orchestratora | `grep -rn "runGuestExperiencePipeline\|ExperiencePipeline" src/` → 0 new |
| G4 | Guest ne importuje Order Core | `grep -rn "create-order\|executeDenisOrderCommand" src/components/guest/` → samo dozvoljeni path |
| G5 | Nema module-level mutable Map/Set u denis | `grep -rn "new Map\|new Set" src/lib/denis/` → samo read-only/constants |
| G6 | Timeline append-only | nema UPDATE/DELETE na denis_timeline u novom kodu |
| G7 | T3 ne odlučuje | nema submit/cart write u narrate/schema |

---

## Phase A — FOLD

### Mora postojati

```bash
test -f src/lib/denis/loop/fold-table-session-state.ts && echo OK
grep -rn "foldTableSessionState" src/lib/denis/
```

### Wire points (svi tri)

- [ ] `run-denis-turn.ts` — FOLD pre DECIDE/reflex
- [ ] `run-denis-sense.ts` — FOLD pre proactive
- [ ] Proactive tick path — FOLD pre eval

### TableSessionState sadržaj (ADR-019 §4)

- [ ] `commerce.orders` — iz Order Core, ne prazan posle submit u eval
- [ ] `commerce.cart` — merged manual + draft
- [ ] `venue.ops` — iz loadEffectiveVenueOps
- [ ] `party` — kad postoji table session
- [ ] `conversation` — goals/beliefs iz kernel fold, ne novi ad-hoc queries u planneru

### Zabrane

- [ ] Planner/narrator **ne otvara** nove Supabase queries po turnu (review `run-denis-turn` diff)
- [ ] Nema novih guest API ruta u Phase A PR

### Eval / timeline

- [ ] `mind.fold_completed` event ili ekvivalent sa metadata
- [ ] Eval fixture: order vidljiv u MIND posle submit mock
- [ ] `pnpm eval:denis` PASS

### truthHash (bonus — preporučeno)

- [ ] Fold vraća `truthHash` za budući actor idempotency

---

## Phase B — VIEW

### Mora postojati

```bash
test -f src/app/api/denis/view/route.ts && echo OK
grep -rn "projectTableSessionView\|project-view" src/lib/denis/
```

### FACE pravila

- [ ] UI komponente čitaju view — ne merge 5 izvora u React state
- [ ] Samo PROJECT piše view row (`guest_scene` / `table_session_view`)
- [ ] `TableSessionView` ima: phase, chrome, layers, transcript, cart, orders, actions

### Integracija

- [ ] Order page ili dock koristi view (bar jedan surface)

### Acceptance partial

- [ ] Posle submit, view.orders i view.transcript konzistentni

---

## Phase C — SIGNAL

```bash
test -f src/app/api/denis/signal/route.ts && echo OK
grep -rn "/api/waiter-calls" src/components/guest/ → 0 direct calls
```

- [ ] Chat/chip/handoff → POST signal
- [ ] Thin wrappers na legacy routes OK; business logic u loop

---

## Phase D — WORLD

- [ ] Order status outbox → Denis signal (ne direktan guest UI update)
- [ ] TELL → PROJECT → notify
- [ ] **Isti tekst:** push = headline = transcript (review string source — jedan TELL output)

### Acceptance ADR-019 §12

| # | Test |
|---|------|
| 1 | ready → push → transcript već ima liniju |
| 2 | Kellner → nema waiter REST |
| 4 | rush → nema dessert chip |

---

## Phase E — ACTOR

- [ ] Queue/lock per `table_session_id`
- [ ] `signalId` dedupe
- [ ] View SSE/Realtime na version bump
- [ ] ADR-013 = signal types only

---

## Phase F — TRUTH

- [ ] Transcript iz timeline, ne dual-write u ai_sessions
- [ ] Replay = timeline + orders

---

## Review session report template

```markdown
## Denis verification — Phase [X]

### Verdict
PASS / FAIL / PARTIAL

### Global (G1–G7)
| Check | OK? | Notes |
|-------|-----|-------|

### Phase-specific
| Check | OK? | Notes |
|-------|-----|-------|

### Tests run
| Command | Result |
|---------|--------|

### Regressions / rizici
- …

### Preporuka operatoru
- Merge / fix before merge / needs Phase [Y] first
```

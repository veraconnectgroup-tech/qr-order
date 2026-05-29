# ADR-025 — Session Prompts (TDE State-Driven Routing)

> **Operator (Jovica):** [ADR-025-operator.md](./ADR-025-operator.md)  
> **Review agent:** [ADR-025-verification-checklist.md](./ADR-025-verification-checklist.md)  
> **Architecture:** [ADR-025-tde-state-driven-routing.md](./ADR-025-tde-state-driven-routing.md)

---

## Status

| Track | Scope | Status |
|-------|-------|--------|
| **T1** | Director rewrite + beliefs mode reorder + unit tests | 🔲 |
| **T2** | `commerce.pressure` + contextual T0 confirm | 🔲 |
| **T3** | Evidence budgets + eval fixtures | 🔲 |
| **Parent** | verify + eval:denis | 🔲 |

---

## Redosled

```
T1 → T2 → T3 → Parent verify → Commit (operator only)
```

---

## Pravilo (svaki implement agent)

```
ZADATAK = IMPLEMENTIRAJ RADNI KOD u repou + pokreni testove.

✅ OBAVEZNO: kreiraj/izmeni fajlove, type-check, test:run, lint, build
❌ ZABRANJENO: proširivati ORDERING_GUEST_PATTERN umesto state routing-a
❌ ZABRANJENO: src/lib/ai/* legacy orchestrator · guest → Order Core bypass
❌ ZABRANJENO: završiti sesiju samo sa summary-jem

Definition of done:
1. git diff pokazuje fajlove iz scope-a
2. test matrix iz ADR-025 §12 PASS za relevantni track
3. pnpm type-check && pnpm lint (0 errors) && pnpm build
4. session report (template na dnu)
5. Ne commit-uj osim ako operator kaže
```

---

# AGENT T1 — Director rewrite (minimal fix)

```
ADR-025 track T1 — TDE state-driven routing. IMPLEMENTIRAJ kod (ne samo čitaj ADR).

Repo: /Users/jovicamihajlovic/Desktop/ordering

CILJ: Regex više ne odlučuje da li Denis zove LLM. Posle L0/L1 early exit-a, free text → perceive.

KORACI:
1. Pročitaj docs/architecture/ADR-025-tde-state-driven-routing.md §4–§10, §12, §13
2. Pročitaj src/lib/denis/cognition/tde/decide-turn-plan.ts (as-built)
3. Pročitaj src/lib/denis/cognition/beliefs/compile-beliefs.ts resolveConversationMode
4. Pročitaj .cursor/rules/commit-checklist.mdc
5. IMPLEMENTIRAJ
6. Pokreni gate-ove dok PASS

FAJL 1: src/lib/denis/cognition/tde/decide-turn-plan.ts

OBRISI / ZAMENI:
- Blok `if (mode === "banter" || isCasualSocialGuestMessage(message))` → planForBanter
- `inferConversationMode()` — koristi samo belief conversation.mode (resolveConversationMode već čita belief)
- `looksLikeOrderLine(message)` kao routing na dnu
- Default fallback `banter.welcome` → relational_perceive

DODAJ:
- `resolvePerceiveKind()` po ADR-025 §4.2
- Settling → template_tell settle.thanks (zadrži)
- mode ordering ILI commerce pressure hint iz belief-a → transactional_perceive
- Inače → relational_perceive (requiresLlm: true)

ZADRŽI bez izmene:
- T0 / handoff → reflex_only
- pending_slot → slot_extract
- goal templates (cart conflict, status, CLARIFY_SLOT)
- committedFacts → narrate_paraphrase
- VAGUE_RECOMMEND → relational_perceive

planForBanter(): obriši ako nigde ne treba; banter.welcome NE kao guest reply default.

ORDERING_GUEST_PATTERN u ovom fajlu: obriši duplikat. looksLikeOrderLine export: ostavi samo ako testovi/eval koriste — ne u routing-u.

FAJL 2: src/lib/denis/cognition/beliefs/compile-beliefs.ts

U resolveConversationMode REORDER (ADR-025 §5.2):
- Posle settling check-a, pre casual social:
  - hasOpenCommerce (cart ili open orders) → ordering confidence 0.85
- Tek onda ORDERING_GUEST_PATTERN hint
- Tek onda isCasualSocialMessage → banter SAMO kad nema open commerce

FAJL 3: src/__tests__/denis-tde.test.ts

Dodaj testove iz ADR-025 §12: A2–A6, A9, A10.
Ažuriraj test "treats casual social message as banter" — očekuj relational_perceive, NE template_tell default.

GATE:
pnpm test:run src/__tests__/denis-tde.test.ts
pnpm type-check
pnpm lint
pnpm build

Session report. Ne commit-uj.
```

---

# AGENT T2 — Beliefs pressure + contextual T0

```
ADR-025 track T2 — commerce.pressure + contextual T0 confirm. IMPLEMENTIRAJ kod.

ZAVISI OD: T1 merged ili T1 diff u istom branch-u.

KORACI:
1. Pročitaj ADR-025 §5, §7
2. IMPLEMENTIRAJ

FAJL 1: src/lib/denis/cognition/beliefs/belief-types.ts
FAJL 2: src/lib/denis/cognition/tde/turn-plan-types.ts
- Dodaj CORE_BELIEF_KEYS:
  - commerce.pressure: "none" | "open" | "confirm"
  - commerce.awaiting_confirm: boolean

FAJL 3: src/lib/denis/cognition/beliefs/compile-beliefs.ts
- CompileBeliefsInput: dodaj flowNodeId?: FlowNodeId
- resolveCommercePressure() po ADR-025 §5.1
- awaiting_confirm = pressure === "confirm"
- Uključi u compileBeliefs output (povećaj belief count u eval)

FAJL 4: src/lib/denis/runtime/run-denis-turn.ts
- compileBeliefs({ ..., flowNodeId: ctx.flowNodeId })

FAJL 5: src/lib/denis/kernel/reflex-rules.ts
- isT0Confirm(message, opts?: { awaitingConfirm?: boolean })
- Kad awaitingConfirm: može|moze|klar|gerne|jep|tamam|evet|oui|si|sí|vale

FAJL 6: src/lib/denis/kernel/reflex-plan.ts
- ReflexTurnInput.awaitingConfirm?: boolean
- resolveT0Reflex(message, { awaitingConfirm })

FAJL 7: src/lib/denis/runtime/run-denis-turn.ts
- planTurnWithReflex: awaitingConfirm iz beliefGraph

FAJL 8: src/lib/denis/cognition/tde/decide-turn-plan.ts
- Koristi commerce.pressure / awaiting_confirm u resolvePerceiveKind

FAJL 9: src/lib/denis/eval/run-beliefs-fixture.ts
- Ažuriraj expected belief count + keys

TEST:
- A1: Može + pressure confirm → reflex_only (T0)
- A2: Može + pressure none → relational_perceive

GATE:
pnpm test:run src/__tests__/denis-tde.test.ts
pnpm eval:denis  # beliefs fixture
pnpm type-check && pnpm lint && pnpm build

Session report. Ne commit-uj.
```

---

# AGENT T3 — Evidence budget + eval

```
ADR-025 track T3 — perceive cost guardrails + eval scenarios.

KORACI:
1. Pročitaj ADR-025 §6, §8
2. Pročitaj src/lib/denis/cognition/context/plan-evidence.ts

FAJL 1: src/lib/denis/cognition/context/plan-evidence.ts
- relational_perceive: manji transcript window, commerce summary only, RAG samo na vague recommend
- transactional_perceive: pun commerce + catalog.rag kad ordering

FAJL 2: src/lib/denis/eval/fixtures/pilot-sr-scenarios.ts
- Scenariji A3 (Daj mi sok), A4 (Merhaba), A1 (Može confirm)

FAJL 3: docs/architecture/denis-implementation-map.md
- Kratka napomena: ADR-025 TDE routing gap closed

GATE:
pnpm eval:denis
pnpm verify:denis  # ako postoji
pnpm type-check && pnpm lint && pnpm build

Session report. Ne commit-uj.
```

---

# PARENT VERIFY

```
ADR-025 PARENT — samo VERIFY, bez novog feature koda.

1. Pročitaj docs/architecture/ADR-025-verification-checklist.md — sve stavke
2. Pročitaj docs/architecture/ADR-025-tde-state-driven-routing.md §12 test matrix

KOMANDE:
pnpm test:run src/__tests__/denis-tde.test.ts
pnpm eval:denis
pnpm type-check
pnpm lint
pnpm build

GREP (mora biti 0 routing usage):
grep -n "isCasualSocialGuestMessage" src/lib/denis/cognition/tde/decide-turn-plan.ts
# ne sme biti u routing uslovu

grep -n "planForBanter" src/lib/denis/cognition/tde/
# ne sme postojati ili samo dead — prefer obriši

Ažuriraj status tabelu u ADR-025-session-prompts.md (T1–T3 ✅).

Session report. Ne commit-uj.
```

---

## Session report template

```markdown
## ADR-025 session — [T1/T2/T3/Parent]

### Done
- [ ] files touched
- [ ] tests PASS
- [ ] type-check / lint / build PASS

### Test matrix
| Case | Expected | Actual |
|------|----------|--------|
| A3 Daj mi sok | transactional_perceive | |

### Blockers
- none

### Next track
- T2 / Parent / commit
```

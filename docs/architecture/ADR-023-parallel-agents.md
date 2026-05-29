# ADR-023 — Parallel Agent Assignments

> **Za Jovicu:** pošalji **jedan prompt po agentu** (A1–A5) u isto vreme.  
> **Merge redosled:** A1 → A2+A3+A4+A5 (paralelno) → integrator → A6 (parent verify).  
> **Parent agent (ti + Cursor):** na kraju pokreni [§Final verification](#final-verification-parent-agent).

---

## Pravila paralelnog rada

| Pravilo | Razlog |
|---------|--------|
| **Jedan agent = jedan scope** | Nema overlap fajlova |
| **Ne diraj tuđe foldere** | Konflikti pri merge |
| **Ne commit-uj** | Operator commituje posle verify |
| **Session report obavezan** | Parent proverava |
| **ADR-019 spine A–F** | Ne reimplementiraj |

### Ko sme dirati šta

| Folder / fajl | Agenti |
|---------------|--------|
| `src/lib/ai/*` (language, leadership) | **A1 only** |
| `src/lib/denis/cognition/beliefs/*` | **A2 only** |
| `src/lib/denis/cognition/tde/*` | **A3 only** |
| `src/lib/denis/cognition/manifest/*` | **A4 only** |
| `src/lib/denis/cognition/context/retrievers/menu-rag.ts` | **A5 only** |
| `src/lib/denis/runtime/run-denis-turn.ts` | **A2 only** (minimal hook) |
| `src/lib/denis/runtime/perceive/*` | **A1 only** |
| `src/lib/denis/elite/*` | **niko** (migrate u MR-3 kasnije) |

**A2** sme **jedan** import + poziv `compileBeliefs` u `run-denis-turn.ts` — ne refactor ostatka turna.

---

## Wave 1 — pokreni svih 5 odjednom

### Agent A1 — MR-0 Language + Leadership

**Scope:** završi language/leadership/followGuest (možda već lokalno u git diff).

**Sme dirati:**
- `src/lib/ai/conversation-leadership.ts`
- `src/lib/ai/guest-language.ts`
- `src/lib/ai/config.ts`
- `src/lib/ai/multilingual-policy.ts`
- `src/lib/ai/build-system-prompt.ts`
- `src/lib/ai/types.ts`
- `src/lib/denis/runtime/perceive/perceive-guest-chat-turn.ts`
- `src/__tests__/conversation-leadership.test.ts`
- `src/__tests__/ai-guest-language.test.ts`

**Ne dirati:** `src/lib/denis/cognition/`, `run-denis-turn.ts`

```
Denis Maximum Runtime — AGENT A1 (MR-0 only).

Pročitaj: docs/architecture/ADR-023-session-prompts.md §MR-0 + ADR-023-parallel-agents.md §Agent A1.

ZADATAK: Finalizuj language + leadership + followGuest. Denis ne sme reći "ne razumem" / "verstehe nicht".
Proveri git diff — možda je već pola urađeno.

DOZVOLJENI FAJLOVI: src/lib/ai/* (conversation-leadership, guest-language, config, build-system-prompt, multilingual-policy, types), src/lib/denis/runtime/perceive/perceive-guest-chat-turn.ts, src/__tests__/conversation-leadership.test.ts, src/__tests__/ai-guest-language.test.ts.

ZABRANJENO: src/lib/denis/cognition/, run-denis-turn.ts, elite/.

Test:
pnpm test:run src/__tests__/conversation-leadership.test.ts src/__tests__/ai-guest-language.test.ts
pnpm eval:denis && pnpm verify:denis && pnpm type-check

Session report po ADR-023-operator.md. Ne commit-uj.
```

---

### Agent A2 — MR-1 compileBeliefs

**Scope:** belief graph + timeline event + eval fixture. Minimal wire u run-denis-turn.

**Sme dirati:**
- `src/lib/denis/cognition/beliefs/**` (novo)
- `src/lib/denis/runtime/run-denis-turn.ts` — **samo** dodaj poziv posle FOLD
- `src/lib/denis/eval/run-beliefs-fixture.ts` (novo)
- `src/__tests__/denis-eval.test.ts` — dodaj test
- `src/lib/denis/platform/timeline-types.ts` — samo ako treba novi event type

**Ne dirati:** `src/lib/ai/*`, `cognition/tde/`, `cognition/manifest/`, perceive

```
Denis Maximum Runtime — AGENT A2 (MR-1 only).

Pročitaj: ADR-023-denis-maximum-runtime.md §3.2 + ADR-023-session-prompts.md §MR-1 + ADR-023-parallel-agents.md §Agent A2.

ZADATAK: Implement compileBeliefs() + BeliefGraph (6 core beliefs: language, mode, pending_slot, rush/skip_upsell, return_visit, require_confirm).
Timeline event: mind.beliefs_compiled. Eval fixture + test u denis-eval.

Kreiraj: src/lib/denis/cognition/beliefs/belief-types.ts, compile-beliefs.ts.

Wire: run-denis-turn.ts — JEDAN poziv compileBeliefs posle FOLD/buildDenisTurnContext. Ne refactoruj ostatak turna.

ZABRANJENO: src/lib/ai/*, cognition/tde/, cognition/manifest/, perceive/, decideTurnPlan.

Test: pnpm eval:denis && pnpm verify:denis && pnpm type-check

Session report. Ne commit-uj.
```

---

### Agent A3 — MR-2 TDE + Templates (bez wire)

**Scope:** decideTurnPlan, UtterancePlan, template-utterance — **ne diraj run-denis-turn**.

**Sme dirati:**
- `src/lib/denis/cognition/tde/**` (novo)
- `src/__tests__/denis-tde.test.ts` (novo)

**Ne dirati:** run-denis-turn, perceive, beliefs/, manifest/, ai/

```
Denis Maximum Runtime — AGENT A3 (MR-2 only).

Pročitaj: ADR-023 §4 (TDE) + ADR-023-session-prompts.md §MR-2 + ADR-023-parallel-agents.md §Agent A3.

ZADATAK: Implement decideTurnPlan(), UtterancePlan, template-utterance.ts.
TurnPlanKind: reflex_only | template_tell | slot_extract | transactional_perceive | relational_perceive | narrate_paraphrase.

Unit tests (bez OpenAI): banter → relational/template; order line → transactional; rush → skip upsell plan.

Kreiraj: src/lib/denis/cognition/tde/ (turn-plan-types, decide-turn-plan, utterance-plan, template-utterance).

ZABRANJENO: run-denis-turn.ts, compileBeliefs wire, perceive, src/lib/ai/*.

Test: pnpm test:run src/__tests__/denis-tde.test.ts && pnpm type-check

Session report. Ne commit-uj.
```

---

### Agent A4 — MR-4 Venue Manifest

**Scope:** zod schema + merge — potpuno izolovano.

**Sme dirati:**
- `src/lib/denis/cognition/manifest/**` (novo)
- `src/__tests__/venue-manifest.test.ts` (novo)
- `src/lib/denis/config/concierge-config.schema.ts` — dodaj optional `manifest` nested object **samo ako minimalno potrebno**

**Ne dirati:** runtime, ai/, tde/, beliefs/

```
Denis Maximum Runtime — AGENT A4 (MR-4 only).

Pročitaj: ADR-023 §6 + ADR-023-session-prompts.md §MR-4 + ADR-023-parallel-agents.md §Agent A4.

ZADATAK: Venue Manifest zod schema + mergeManifestConfig() spaja manifest + ConciergeConfig.
Parse primer iz ADR-023 §6. Invalid manifest → graceful fallback.

Kreiraj: src/lib/denis/cognition/manifest/venue-manifest.schema.ts, merge-manifest-config.ts.
Tests: src/__tests__/venue-manifest.test.ts.

Ne radi admin UI u ovom PR-u. Ne migracija DB — nested u ai_concierge_config OK.

ZABRANJENO: run-denis-turn, perceive, beliefs/, tde/, src/lib/ai/*.

Test: pnpm test:run src/__tests__/venue-manifest.test.ts && pnpm type-check

Session report. Ne commit-uj.
```

---

### Agent A5 — MR-6 Menu RAG (keyword v1)

**Scope:** menu RAG retriever — izolovan, bez wire u perceive (export only).

**Sme dirati:**
- `src/lib/denis/cognition/context/retrievers/menu-rag.ts` (novo)
- `src/lib/denis/cognition/context/menu-rag-types.ts` (novo)
- `src/__tests__/menu-rag.test.ts` (novo)

**Ne dirati:** perceive prompt, run-denis-turn

```
Denis Maximum Runtime — AGENT A5 (MR-6 keyword RAG only).

Pročitaj: ADR-023 §7 + ADR-023-session-prompts.md §MR-6 + ADR-023-parallel-agents.md §Agent A5.

ZADATAK: menu-rag retriever v1 — keyword + postojeći catalog-search, top-k product IDs + names.
Export: retrieveMenuEvidence(query, catalog) → { productIds, snippet }.
Gate helper: isMenuRagEnabled(capability level) — bez wire u perceive (MR-5 kasnije).

ZABRANJENO: perceive, run-denis-turn, prompt changes, embeddings/DB migration.

Test: pnpm test:run src/__tests__/menu-rag.test.ts && pnpm type-check

Session report. Ne commit-uj.
```

---

## Wave 2 — posle merge Wave 1 (jedan agent)

### Agent A6 — MR-3 TDE Wire + MR-5 Evidence (integrator)

**Pokreni tek kad A1–A5 imaju session report PASS.**

```
Denis Maximum Runtime — AGENT A6 (MR-3 + MR-5 integrator).

Pročitaj: ADR-023-session-prompts.md §MR-3 + §MR-5 + ADR-023-parallel-agents.md §Agent A6.

PREUSLOV: cognition/beliefs/, cognition/tde/, cognition/manifest/, menu-rag retriever postoje.

ZADATAK:
1. Wire compileBeliefs → decideTurnPlan → perceive u run-denis-turn (LLM samo kad plan.requiresLlm).
2. Evidence pointers: plan-evidence.ts + retrievers (commerce, transcript, guest, ops) — integrate u perceive prompt.
3. Migrate src/lib/denis/elite/ → cognition/resolve-runtime-profile.ts (re-export OK).

pnpm verify:denis && pnpm eval:denis && pnpm type-check && pnpm build

Session report. Ne commit-uj.
```

---

## Wave 3 — posle A6

| Agent | Track | Prompt source |
|-------|-------|---------------|
| A7 | MR-7 Quality Contract | ADR-023-session-prompts §MR-7 |
| A8 | MR-8 Sim gate | §MR-8 |
| A9 | MR-9 Org pack | §MR-9 |

(Koristi generic operator prompt sa MR-7/8/9 iz session-prompts.md.)

---

## Final verification (parent agent)

Kada svi agenti jave gotovo, parent pokreće:

```bash
# 1. Scope — nema overlap grešaka
git status
git diff --stat

# 2. Svaki agent deliverable postoji
test -f src/lib/ai/conversation-leadership.ts && echo A1 OK
test -f src/lib/denis/cognition/beliefs/compile-beliefs.ts && echo A2 OK
test -f src/lib/denis/cognition/tde/decide-turn-plan.ts && echo A3 OK
test -f src/lib/denis/cognition/manifest/venue-manifest.schema.ts && echo A4 OK
test -f src/lib/denis/cognition/context/retrievers/menu-rag.ts && echo A5 OK

# 3. Full gates
pnpm verify:denis
pnpm eval:denis
pnpm type-check
pnpm lint
pnpm build

# 4. Parallel-specific
grep -rn "compileBeliefs" src/lib/denis/runtime/run-denis-turn.ts
grep -rn "decideTurnPlan" src/lib/denis/
grep -rn "applyConversationLeadership" src/lib/denis/runtime/perceive/
```

### Parent checklist po agentu

| Agent | Deliverable | Test | PASS? |
|-------|-------------|------|-------|
| A1 | leadership + followGuest + SR switch | conversation-leadership.test | |
| A2 | compileBeliefs + timeline + eval | denis-eval beliefs fixture | |
| A3 | decideTurnPlan + templates | denis-tde.test | |
| A4 | manifest schema + merge | venue-manifest.test | |
| A5 | menu-rag retriever | menu-rag.test | |
| A6 | TDE wire + evidence | eval:denis full | |

### Parent session report template

```markdown
## ADR-023 Parallel verify — [datum]

### Agent status
| Agent | Verdict | Notes |
|-------|---------|-------|
| A1 | PASS/FAIL | |
| A2 | PASS/FAIL | |
| A3 | PASS/FAIL | |
| A4 | PASS/FAIL | |
| A5 | PASS/FAIL | |
| A6 | PASS/FAIL/N/A | |

### Merge blockers
- …

### Global gates
| Command | Result |

### Preporuka operatoru
- Commit wave 1 / fix A? / run A6
```

---

## Brzi copy — svi Wave 1 promptovi odjednom

Pošalji **5 odvojenih chatova** — svaki agent dobija **samo svoj** blok iz sekcija A1–A5 gore.

**Ne šalji A6 dok A1–A5 nisu gotovi.**

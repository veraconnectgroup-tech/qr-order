# ADR-023 — Session Prompts (Denis Maximum Runtime)

> **Operator (Jovica):** [ADR-023-operator.md](./ADR-023-operator.md) — jedna linija.  
> **Implement agent:** ovaj fajl + obavezna literatura ispod.

---

## Obavezna literatura (pročitaj PRE koda)

1. [ADR-023-denis-maximum-runtime.md](./ADR-023-denis-maximum-runtime.md) — Belief→Policy→Language, MR map, invariants
2. [ADR-019-denis-unified-brain.md](./ADR-019-denis-unified-brain.md) — loop (ne diraj spine)
3. [ADR-020-denis-table-operating-system.md](./ADR-020-denis-table-operating-system.md) — Table OS, anticipation
4. [ADR-021-denis-concierge-tuning.md](./ADR-021-denis-concierge-tuning.md) — pilot profiles, tiers
5. [denis-implementation-map.md](./denis-implementation-map.md) — as-built M0–M28, phases A–F ✅
6. [.cursor/rules/commit-checklist.mdc](../../.cursor/rules/commit-checklist.mdc)
7. [.cursor/rules/denis-architecture.mdc](../../.cursor/rules/denis-architecture.mdc)

**Supabase:** [ADR-001-safe-rollout.md](./ADR-001-safe-rollout.md) pre migracije.

---

## Status implementacije (ažuriraj posle svake sesije)

| Track | Status | Ključni fajlovi |
|-------|--------|-----------------|
| **MR-0** | 🟡 lokalno | `conversation-leadership.ts`, `guest-language.ts`, `build-system-prompt.ts`, `perceive-guest-chat-turn.ts` |
| **MR-1** | 🔲 | `src/lib/denis/cognition/beliefs/compile-beliefs.ts` |
| **MR-2** | 🔲 | `src/lib/denis/cognition/tde/decide-turn-plan.ts` |
| **MR-3** | 🔲 | wire u `run-denis-turn.ts` |
| **MR-4** | 🔲 | `cognition/manifest/venue-manifest.schema.ts` |
| **MR-5** | 🔲 | `cognition/context/plan-evidence.ts` |
| **MR-6** | 🔲 | `cognition/context/retrievers/menu-rag.ts` |
| **MR-7** | 🔲 | `cognition/quality/turn-profile.ts` |
| **MR-8** | 🔲 | sim gate + admin promote |
| **MR-9** | 🔲 | org manifest pack |

**ADR-019 A–F + G1–G4:** ✅ — ne reimplementiraj.

---

## Operator checklist (svaka sesija)

1. `git status` + diff
2. **Tačno jedan MR track** — ne mega PR
3. Pre izmene: `grep -rn "functionName" src/`
4. Posle koda:

```bash
pnpm verify:denis
pnpm eval:denis
pnpm type-check
pnpm lint
pnpm build
```

5. Session report ([ADR-023-operator.md](./ADR-023-operator.md))
6. **Ne commit-uj** osim ako operator kaže

---

## Global invariants (svaki MR)

| # | Pravilo |
|---|---------|
| G1 | Jedan PR = jedan MR track |
| G2 | LLM ne piše orders — samo ACL/act |
| G3 | Beliefs su derived — ne dual-write u ai_sessions |
| G4 | Template pre LLM kad god može |
| G5 | Nema `new Map/Set` module-level u `src/lib/denis/` |
| G6 | Nema drugog orchestratora |
| G7 | `pnpm verify:denis` PASS |

---

## MR-0 — Language + Leadership (ship first)

### Cilj

Denis **ne odustaje**; prati jezik gosta; vodi razgovor.

### Scope (proveri git — možda već lokalno)

1. `src/lib/ai/conversation-leadership.ts` — refusal detect + leadership fallback
2. `src/lib/ai/guest-language.ts` — `followGuest`, explicit SR/DE switch
3. `src/lib/ai/config.ts` — balkan detection words
4. `src/lib/ai/build-system-prompt.ts` — `venueMenuLocale`, leadership block
5. `src/lib/denis/runtime/perceive/perceive-guest-chat-turn.ts` — wire config + `applyConversationLeadership`
6. Tests: `conversation-leadership.test.ts`, `ai-guest-language.test.ts`

### Acceptance

```bash
pnpm test:run src/__tests__/conversation-leadership.test.ts src/__tests__/ai-guest-language.test.ts
pnpm eval:denis
```

- [ ] “Denis legendo gde si” → SR leadership, ne refusal
- [ ] “nein nur auf Serbisch” → `language=sr`
- [ ] `followGuest: false` → venue locale only

### Ne raditi u MR-0

- `compileBeliefs` (MR-1)
- Venue manifest (MR-4)

---

## MR-1 — compileBeliefs

### Cilj

Posle FOLD-a, eksplicitni **BeliefGraph** sa confidence + source.

### Implementacija

1. **Kreiraj** `src/lib/denis/cognition/beliefs/belief-types.ts`
2. **Kreiraj** `src/lib/denis/cognition/beliefs/compile-beliefs.ts`
   - Input: `TableSessionState`, guest message, `ConciergeConfig`, optional memory
   - Output: `BeliefGraph` (array of `Belief`)
3. **Core beliefs (minimum 6):**
   - `conversation.language`
   - `conversation.mode` (`banter` | `ordering` | `settling`)
   - `commerce.pending_slot` (nullable)
   - `venue.rush` / `venue.skip_upsell`
   - `guest.return_visit`
   - `policy.require_confirm`
4. **Wire** u `run-denis-turn.ts` posle FOLD / `buildDenisTurnContext`
5. **Timeline:** `mind.beliefs_compiled` sa `beliefsHash`, key summary (ne ceo graph u payload ako prevelik)
6. **Eval fixture:** `src/lib/denis/eval/run-beliefs-fixture.ts` + test u `denis-eval.test.ts`

### grep acceptance

```bash
grep -rn "compileBeliefs" src/lib/denis/
# mora: run-denis-turn (min)
```

### Ne raditi

- TDE wire (MR-3)
- Nova guest API

---

## MR-2 — Turn Decision Engine + UtterancePlan

### Cilj

**Code** odlučuje da li treba LLM; template-first odgovori.

### Implementacija

1. **Kreiraj** `src/lib/denis/cognition/tde/turn-plan-types.ts`
   - `TurnPlanKind`: `reflex_only` | `template_tell` | `slot_extract` | `transactional_perceive` | `relational_perceive` | `narrate_paraphrase`
2. **Kreiraj** `src/lib/denis/cognition/tde/decide-turn-plan.ts`
   - Input: `BeliefGraph`, reflex plan, guest message
   - Output: `TurnPlan` sa `requiresLlm: boolean`
3. **Kreiraj** `src/lib/denis/cognition/tde/utterance-plan.ts` + `template-utterance.ts`
   - Map beliefs + goals → `UtterancePlan` → i18n template string
   - Banter → template “Tu sam! Šta piješ…” (sr/de/en)
4. **Tests:** banter → `relational_perceive` or `template_tell`; order line → `transactional_perceive`

### Acceptance

- [ ] Banter belief → plan ≠ transactional JSON
- [ ] `pending_slot` belief → `slot_extract` or clarify template
- [ ] Rush belief → plan skips upsell intents

---

## MR-3 — TDE wire u run-denis-turn

### Cilj

LLM se zove **samo** kad `TurnPlan.requiresLlm === true`.

### Implementacija

1. Refactor `run-denis-turn.ts` flow:

```
FOLD → compileBeliefs → decideTurnPlan → [ACT as today]
  → if template_tell: skip perceive LLM, use template
  → if transactional_perceive: perceive JSON (commerce model from elite profile)
  → if relational_perceive: social path (free text) + leadership sanitizer
  → narrate as today
```

2. Migrate `src/lib/denis/elite/` → `src/lib/denis/cognition/resolve-runtime-profile.ts` (or re-export)
3. Wire `resolvePerceiveModel(profile, mode)` u perceive
4. Log `turn_profile` u observability (`turn-observability.ts`)

### Acceptance

- [ ] Template-only turn ne zove OpenAI (mock ili metric)
- [ ] Order turn i dalje prolazi eval golden scenarios
- [ ] `pnpm eval:denis` PASS

### Ne raditi

- Menu RAG (MR-6)

---

## MR-4 — Venue Manifest

### Cilj

Deklarativni deploy paket po lokaciji.

### Implementacija

1. `src/lib/denis/cognition/manifest/venue-manifest.schema.ts` (zod)
2. `merge-manifest-config.ts` — manifest + ConciergeConfig → effective runtime config
3. Store: nested `ai_concierge_config.manifest` **or** migration `locations.venue_manifest` (prefer nested first, migration in separate PR if needed)
4. Admin: read-only preview on `/admin/settings` (optional strip — minimal OK)

### Acceptance

- [ ] Parse sample YAML/JSON from ADR-023 §6
- [ ] Invalid manifest → fallback platform defaults
- [ ] `capabilities.*` clamps features

---

## MR-5 — Evidence pointers

### Cilj

LLM prompt = UtterancePlan + Evidence, ne full menu uvek.

### Implementacija

1. `src/lib/denis/cognition/context/plan-evidence.ts`
2. Retrievers (pure functions):
   - `commerce-evidence.ts`
   - `transcript-window.ts`
   - `guest-intel-evidence.ts`
   - `venue-ops-evidence.ts`
3. Wire u perceive prompt builder — replace unconditional full `menuText` when plan allows

### Acceptance

- [ ] Banter turn: evidence bez catalog.rag
- [ ] Recommend turn: playbook + optional rag stub

---

## MR-6 — Menu RAG

### Cilj

Top-k proizvoda po upitu — manje halucinacija.

### Implementacija

1. `src/lib/denis/cognition/context/retrievers/menu-rag.ts`
2. Start: keyword + catalog search (reuse `catalog-search.ts`) — embeddings optional phase 2
3. Gate: `manifest.capabilities.catalog_rag >= 2` or `elite.menuRagEnabled`
4. **Never** replace price truth — ACL still validates product IDs

### Acceptance

- [ ] “Nešto bez glutena” → evidence contains real product IDs from DB
- [ ] Eval: no proposeItems with unknown productId

---

## MR-7 — Quality Contract

### Cilj

Merljivi SLO za enterprise.

### Implementacija

1. `src/lib/denis/cognition/quality/turn-profile.ts` — append timeline metadata
2. `contract-eval.ts` — refusal rate from fixtures
3. Extend turn observability logs: `llmUsed`, `planKind`, `tier`
4. Admin strip: last 24h llm_invocation_rate (read from logs or timeline aggregate — start with eval-only OK)

### Acceptance

- [ ] Refusal fixtures → contract fail
- [ ] Golden eval → contract pass

---

## MR-8 — Sim gate before promote

### Cilj

Manifest promote samo posle venue sim replay.

### Implementacija

1. Hook `POST /api/admin/denis-venue-sim` or server action — compare manifest vN vs vN+1
2. Block save if eval regression
3. Document ops flow in ADR-021

### Acceptance

- [ ] Promote blocked when sim reports failed scenarios
- [ ] Rollback = revert manifest version

---

## MR-9 — Org manifest pack

### Cilj

Chain white-label — org playbook + eval suite.

### Implementacija

1. `organizations.ai_concierge_config.elite.playbookPackId`
2. Platform admin: assign pack to org
3. Custom eval scenarios loaded per org for `pnpm eval:denis` extension (optional script)

### Acceptance

- [ ] Two locations same org share playbook pack
- [ ] Location overlay still works

---

## Copy-paste promptovi po MR

### MR-0

```
Denis Maximum Runtime MR-0. Pročitaj ADR-023-session-prompts.md §MR-0.
Finalizuj i testiraj language + leadership + followGuest. Proveri git diff (conversation-leadership, guest-language, perceive).
pnpm verify:denis && pnpm eval:denis && pnpm type-check && pnpm lint.
Session report. Ne commit-uj.
```

### MR-1

```
Denis Maximum Runtime MR-1. Pročitaj ADR-023 §3.2 + session-prompts §MR-1.
Implement compileBeliefs + mind.beliefs_compiled timeline + eval fixture.
Folder: src/lib/denis/cognition/beliefs/. Wire run-denis-turn posle FOLD.
Jedan PR. pnpm verify:denis && pnpm eval:denis && pnpm type-check.
Session report. Ne commit-uj.
```

### MR-2

```
Denis Maximum Runtime MR-2. Pročitaj ADR-023 §4 (TDE) + session-prompts §MR-2.
Implement decideTurnPlan, UtterancePlan, template-utterance. Unit tests za banter vs order.
Ne wire u run-denis-turn još (to je MR-3). pnpm type-check && pnpm test:run src/lib/denis/cognition.
Session report. Ne commit-uj.
```

### MR-3

```
Denis Maximum Runtime MR-3. Pročitaj session-prompts §MR-3.
Wire TDE u run-denis-turn — LLM samo kad TurnPlan.requiresLlm. Migrate elite/ → cognition/resolve-runtime-profile.
pnpm verify:denis && pnpm eval:denis && pnpm type-check && pnpm build.
Session report. Ne commit-uj.
```

### MR-4

```
Denis Maximum Runtime MR-4. Venue Manifest schema + merge sa ConciergeConfig.
Pročitaj ADR-023 §6. Zod + merge-manifest-config.ts. Minimal admin preview optional.
pnpm type-check && pnpm test:run (add manifest tests).
Session report. Ne commit-uj.
```

### MR-5

```
Denis Maximum Runtime MR-5. Evidence pointers — plan-evidence + retrievers (commerce, transcript, guest, ops).
Integrate u perceive prompt — ne full menu na banter turn.
pnpm verify:denis && pnpm eval:denis && pnpm type-check.
Session report. Ne commit-uj.
```

### MR-6

```
Denis Maximum Runtime MR-6. Menu RAG retriever (keyword v1 OK). Gate na catalog_rag capability.
pnpm eval:denis && pnpm type-check. No unknown productId in eval.
Session report. Ne commit-uj.
```

### MR-7

```
Denis Maximum Runtime MR-7. Quality Contract — turn_profile timeline + contract-eval + observability fields.
Session report. Ne commit-uj.
```

### MR-8

```
Denis Maximum Runtime MR-8. Sim gate before manifest promote — hook venue sim, block on regression.
Session report. Ne commit-uj.
```

### MR-9

```
Denis Maximum Runtime MR-9. Org manifest pack + playbookPackId + platform wiring.
Session report. Ne commit-uj.
```

---

## Po MR merge — ažuriraj

1. Status tabelu u **ovom fajlu** (🔲 → ✅)
2. `denis-implementation-map.md` §MR ako dodato
3. `ADR-023-denis-maximum-runtime.md` §10 status kolona

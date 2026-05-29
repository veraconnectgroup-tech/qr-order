# ADR-023 — Operator mode (Denis Maximum Runtime)

> **Za tebe (Jovica):** nalepi **jednu liniju** ispod.  
> **Implement agent:** [ADR-023-session-prompts.md](./ADR-023-session-prompts.md)  
> **Review agent:** [ADR-023-verification-checklist.md](./ADR-023-verification-checklist.md)

---

## Zakucano (ne diraj)

| Sloj | Značenje |
|------|----------|
| **TRUTH** | timeline + orders + fiscal — append-only |
| **BELIEF** | `compileBeliefs()` posle FOLD — scored, replayable |
| **POLICY** | kernel + flow + ACL — **code only** |
| **LANGUAGE** | template → optional LLM — **last** |

**Spine (već shipped):** ADR-019 loop A–F · signal/view · actor · ACL submit  
**Ovaj track:** MR-0 → MR-9 (Belief → TDE → Manifest → Quality)

**Ne graditi:** drugi orchestrator · LLM submit · guest → Order Core direktno

---

## Promptovi — kopiraj jedan

### 🟢 Paralelno (5 agenta odjednom — Wave 1)

Pročitaj **[ADR-023-parallel-agents.md](./ADR-023-parallel-agents.md)** — pošalji A1–A5 u odvojene chatove.

Parent na kraju: isti fajl §Final verification.

### 🟢 Default (jedan agent, sekvencijalno)

```
Denis Maximum Runtime operator mode. Pročitaj docs/architecture/ADR-023-session-prompts.md (status tabela + Operator checklist).
Uradi sledeći nedovršeni MR track (MR-0→MR-9, jedan PR). Sam vodi provere.
Session report na kraju. Ne commit-uj osim ako kažem.
```

### 🟡 Konkretan MR track

```
Denis Maximum Runtime — MR-1 (compileBeliefs).
Pročitaj ADR-023-session-prompts.md §MR-1 + ADR-023-denis-maximum-runtime.md §3.2.
Jedan PR scope. pnpm verify:denis && pnpm eval:denis && pnpm type-check.
Session report. Ne commit-uj.
```

Zameni `MR-1` sa: `MR-0`, `MR-2`, `MR-3`, … `MR-9`.

### 🔵 Samo provera (bez koda)

```
Denis Maximum Runtime status check. Pročitaj ADR-023 + denis-implementation-map.
Uporedi doc vs git (cognition/, compileBeliefs, decideTurnPlan, MR status).
Session report. Bez koda.
```

### 🟣 Review implementacije

```
Denis Maximum Runtime verification. Pročitaj ADR-023-verification-checklist.md.
Proveri da je MR-[X] ispravno implementiran vs ADR-023. Session report. Bez koda osim grep/test.
```

### ⚪ Commit / PR

```
Commituj Denis MR-[X] rad sa porukom u stilu repoa. Ne push-uj.
```

---

## Redosled MR (agent prati ovo)

| Track | Deliverable | Gate |
|-------|-------------|------|
| **MR-0** | language + leadership + followGuest | eval language + leadership tests |
| **MR-1** | `compileBeliefs()` + timeline event | eval belief fixtures |
| **MR-2** | `decideTurnPlan()` + templates | template covers banter |
| **MR-3** | TDE wire u `run-denis-turn` | LLM only when plan says |
| **MR-4** | Venue Manifest schema + merge | zod parse + admin |
| **MR-5** | Evidence pointers | no full menu every turn |
| **MR-6** | Menu RAG | no hallucinated SKU |
| **MR-7** | Quality Contract metrics | turn_profile timeline |
| **MR-8** | Sim gate pre promote | venue sim replay |
| **MR-9** | Org manifest pack | custom eval |

**Pilot gate:** MR-0 deployed + ADR-021 table_os_pilot na jednoj lokaciji.

---

## Session report (implement agent popunjava)

```markdown
## Denis Maximum Runtime — MR-[X]

### Urađeno
- …

### Verifikacija
| Check | Rezultat |
|-------|----------|
| pnpm verify:denis | PASS/FAIL |
| pnpm eval:denis | PASS/FAIL |
| pnpm type-check | PASS/FAIL |
| pnpm lint | PASS/FAIL |
| pnpm build | PASS/FAIL |

### MR acceptance (ADR-023 §12)
- … (PASS/FAIL po tački)

### Fajlovi
- …

### Sledeći korak
- …

### Rizici
- … (ili "nema")
```

---

## Gde je detalj

| Tema | Fajl |
|------|------|
| **Maximum ceiling** | `ADR-023-denis-maximum-runtime.md` |
| **Detaljni promptovi** | `ADR-023-session-prompts.md` |
| **Paralelno (5 agenta)** | `ADR-023-parallel-agents.md` |
| **Review checklist** | `ADR-023-verification-checklist.md` |
| Loop spine | `ADR-019-denis-unified-brain.md` |
| Ops tuning | `ADR-021-denis-concierge-tuning.md` |
| As-built | `denis-implementation-map.md` |
| Pre-commit | `.cursor/rules/commit-checklist.mdc` |

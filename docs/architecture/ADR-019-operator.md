# ADR-019 — Operator mode (Denis Unified Brain)

> **Za tebe (Jovica):** ne čitaj session-prompts — nalepi **jednu liniju** ispod.  
> **Implement agent:** `ADR-019-session-prompts.md`  
> **Review agent (kasnije):** `ADR-019-verification-checklist.md`

---

## Usvojena arhitektura (zakucano)

| Sloj | Značenje |
|------|----------|
| **TRUTH** | `denis_timeline` + Order Core + fiscal — append-only |
| **MIND** | `foldTableSessionState()` — rebuild svaki loop |
| **FACE** | `TableSessionView` — samo PROJECT piše |

**Loop:** `SIGNAL → FOLD → DECIDE → ACT → TELL → PROJECT`  
**Guest API cilj:** `POST /api/denis/signal` · `GET /api/denis/view` (+ SSE u Phase E)  
**Kompletna arhitektura:** Phase **A → E** (obavezno) + **F** (single TRUTH stream)

**Ne graditi:** `runGuestExperiencePipeline`, drugi orchestrator, guest → Order Core direktno.

---

## Promptovi — kopiraj jedan

### 🟢 Default (agent bira sledeću fazu)

```
Denis brain operator mode. Pročitaj docs/architecture/ADR-019-session-prompts.md (Operator checklist + status tabela).
Uradi sledeću nedovršenu fazu (A→F, jedan korak po PR-u). Sam vodi provere.
Na kraju session report. Ne commit-uj osim ako kažem.
```

### 🟡 Konkretna faza

```
Denis brain operator mode — Phase A (FOLD).
Pročitaj ADR-019-session-prompts.md §Phase A + ARCHITECTURE-INDEX §6.
Jedan PR scope. pnpm verify:denis && pnpm eval:denis && pnpm type-check.
Session report na kraju. Ne commit-uj.
```

Zameni `Phase A` sa: `Phase B`, `Phase C`, `Phase D`, `Phase E`, `Phase F`.

### 🔵 Samo provera (bez koda)

```
Denis brain status check. Pročitaj ARCHITECTURE-INDEX + denis-implementation-map §7b.
Uporedi doc vs git (foldTableSessionState, view API, signal API, actor).
Session report. Bez koda.
```

### 🟣 Review implementacije (drugi agent proverio — ti verifikuješ)

```
Denis brain verification. Pročitaj docs/architecture/ADR-019-verification-checklist.md.
Proveri da je Phase [X] ispravno implementirana vs ADR-019/020. Session report. Bez koda osim grep/test.
```

### ⚪ Commit / PR

```
Commituj Denis Phase [A] rad sa porukom u stilu repoa. Ne push-uj.
```

---

## Redosled faza (agent prati ovo)

| Faza | Deliverable | Gate |
|------|-------------|------|
| **A — FOLD** | `foldTableSessionState()` u turn/sense/proactive | eval: MIND vidi orders |
| **B — VIEW** | `GET /api/denis/view` | UI jedan read path (order page prvo) |
| **C — SIGNAL** | `POST /api/denis/signal` | nema guest waiter REST |
| **D — WORLD** | outbox → loop → TELL + guest push | push = transcript = headline |
| **E — ACTOR** | queue + lock + view SSE | multi-phone bez race |
| **F — TRUTH** | transcript samo timeline; retire ai_sessions drift | replay bez dual-write |

**Marketing gate:** Phase D + `denis_only` pilot. **Scale gate:** Phase E.

---

## Session report (implement agent popunjava)

```markdown
## Denis brain session — [Phase A / status / …]

### Urađeno
- …

### Verifikacija
| Check | Rezultat |
|-------|----------|
| pnpm verify:denis | PASS/FAIL |
| pnpm eval:denis | PASS/FAIL / N/A |
| pnpm type-check | PASS/FAIL |
| pnpm lint | PASS/FAIL |
| pnpm build | PASS/FAIL |

### Acceptance (ADR-019 §12)
- … (N/A ili PASS/FAIL po testu)

### Fajlovi
- …

### Sledeći korak
- …

### Rizici / tvoja odluka
- … (ili "nema")
```

---

## Gde je detalj

| Tema | Fajl |
|------|------|
| **Mapa svega** | `ARCHITECTURE-INDEX.md` |
| **Inženjering spine** | `ADR-019-denis-unified-brain.md` |
| **Vizija Table OS** | `ADR-020-denis-table-operating-system.md` |
| **As-built M0–M28** | `denis-implementation-map.md` §3–4, §7b |
| **Detaljni promptovi po fazi** | `ADR-019-session-prompts.md` |
| **Review checklist** | `ADR-019-verification-checklist.md` |
| Pre-commit | `.cursor/rules/commit-checklist.mdc` |
| Denis layers | `.cursor/rules/denis-architecture.mdc` |

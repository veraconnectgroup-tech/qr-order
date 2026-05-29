# ADR-024 — Operator mode (Staff Duties & Access)

> **Za tebe (Jovica):** nalepi **jednu liniju** ispod.  
> **Implement agent:** `ADR-024-session-prompts.md`  
> **Review agent:** `ADR-024-verification-checklist.md`

---

## Usvojena arhitektura (zakucano)

| Sloj | Značenje |
|------|----------|
| **Identity** | Supabase auth + `staff` + `staff_locations` |
| **Authorization** | `resolveStaffAccess()` — template ∪ grants − revokes |
| **Surfaces** | Svako u **svoj app** — permissions proširuju **modul unutar app-a** |

**Hard rules:** SA-1 … SA-7 u [ADR-024 §2](./ADR-024-staff-duties-access.md)  
**Fiscal:** `fiscal.shift.close` = Z-Bon · `fiscal.report.daily` = izveštaj bez TSE · ADR-011/012 guards

**Ne graditi:** jedan mega-dashboard za sve · `staff.role ===` u API/layout (legacy migrira u S6)

---

## Promptovi — kopiraj jedan

### 🟢 Default (agent IMPLEMENTIRA sledeći track)

```
ADR-024 staff access — IMPLEMENTIRAJ kod (ne samo čitaj ADR).
Pročitaj docs/architecture/ADR-024-session-prompts.md + uradi sledeći nedovršeni S-track.
Kreiraj/izmeni fajlove, pokreni testove dok ne PASS, session report sa git diff.
Ne commit-uj osim ako kažem.
```

### 🟡 Konkretan track

```
ADR-024 operator mode — track S0.
Pročitaj ADR-024-session-prompts.md §S0 + ADR-024-staff-duties-access.md §4–§6.
Jedan PR scope. pnpm test:run src/__tests__/staff-access.test.ts && pnpm type-check.
Session report na kraju. Ne commit-uj.
```

Zameni `S0` sa: `S1`, `S2`, `S3`, `S4`, `S5`, `S6`, `S7`.

### 🔵 Samo provera (bez koda)

```
ADR-024 status check. Pročitaj ADR-024-staff-duties-access.md + git diff.
Uporedi doc vs as-built (resolveStaffAccess, middleware surfaces, fiscal API role arrays).
Session report. Bez koda osim grep/test.
```

### 🟣 Review implementacije

```
ADR-024 verification. Pročitaj docs/architecture/ADR-024-verification-checklist.md.
Proveri da je track [S3] ispravno implementiran vs ADR-024. Session report.
```

### ⚪ Commit / PR

```
Commituj ADR-024 S0 rad sa porukom u stilu repoa. Ne push-uj.
```

---

## Redosled trackova

| Track | Deliverable | Gate |
|-------|-------------|------|
| **S0** | permission catalog + `resolveStaffAccess` + tests | fixture tests green |
| **S1** | provider + override loader stub | type-check |
| **S2** | middleware + layout surface guards | waiter blocked from `/dashboard` |
| **S3** | DB overrides + admin permission matrix | owner grants waiter Z-Bon |
| **S4** | `/bar` surface + `bar` role | bar login → `/bar` |
| **S5** | `/kitchen` + `/waiter/fiscal` module | Z-Bon from waiter app |
| **S6** | fiscal API → `assertPermission` | no role arrays in fiscal routes |
| **S7** | dual-control + audit (opciono) | org flag |

**Ne kombinuj S3 + S6** u jednom PR-u.

---

## Paralelni agenti — IMPLEMENT (više chat-ova)

Svaki prompt ispod = **ceo blok** iz [ADR-024-parallel-agents.md](./ADR-024-parallel-agents.md). Agent **mora napisati kod**, ne samo pročitati ADR.

| Wave | Agent | Akcija |
|------|-------|--------|
| 0 | **B0** | Copy §Wave 0 — implement S0+S1+S2 |
| 1 | **A1 + A2 + A3** | 3 chata paralelno — copy §Wave 1 blokove |
| 2 | **I0** | Copy §Wave 2 — integrator |
| 3 | **F0** | Copy §Wave 3 — fiscal API |
| ✓ | **P0 (ti)** | Copy §Parent P0 — verify only |

**Ne šalji one-liner "pročitaj ADR"** — šalji **pun copy-paste blok** iz parallel-agents.md.

---

## Session report (implement agent popunjava)

```markdown
## ADR-024 session — [S0 / …]

### Urađeno
- …

### Verifikacija
| Check | Rezultat |
|-------|----------|
| pnpm test:run staff-access | PASS/FAIL |
| pnpm type-check | PASS/FAIL |
| pnpm lint | PASS/FAIL |
| pnpm build | PASS/FAIL |

### Acceptance (ADR-024 §15)
- …

### Fajlovi
- …

### Sledeći korak
- …

### Rizici / tvoja odluka
- …
```

---

## Gde je detalj

| Tema | Fajl |
|------|------|
| **Arhitektura** | `ADR-024-staff-duties-access.md` |
| **Detaljni promptovi** | `ADR-024-session-prompts.md` |
| **Paralelno (A1–A3)** | `ADR-024-parallel-agents.md` |
| **Review** | `ADR-024-verification-checklist.md` |
| **Mapa** | `ARCHITECTURE-INDEX.md` §2.4 |
| Fiscal spine | `ADR-011` · `ADR-012` |
| Pre-commit | `.cursor/rules/commit-checklist.mdc` |
| Supabase | `ADR-001-safe-rollout.md` · `supabase-migration-baseline.md` |

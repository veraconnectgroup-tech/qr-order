# ADR-024 — Parallel Agent Assignments (Staff Access)

> **Za Jovicu:** pošalji **ceo copy-paste blok** ispod za svakog agenta.  
> **Ti proveravaš na kraju** — [§Parent P0](#parent-p0--verify-only).  
> **Arhitektura:** [ADR-024-staff-duties-access.md](./ADR-024-staff-duties-access.md)

---

## ⚠️ Pravilo za SVE implement agente

```
ZADATAK = IMPLEMENTIRAJ RADNI KOD u repou + pokreni testove.

✅ OBAVEZNO: kreiraj/izmeni fajlove, type-check, test:run, build (gde navedeno)
❌ ZABRANJENO: završiti sesiju samo sa summary-jem ili "pročitao sam ADR"
❌ ZABRANJENO: "spremno za implementaciju" bez git diff-a

Definition of done:
1. git diff pokazuje nove/izmenjene fajlove iz scope-a
2. navedeni testovi PASS
3. session report sa listom fajlova + PASS/FAIL tabela
4. Ne commit-uj osim ako operator kaže
```

---

## Pregled wave-ova

```
Wave 0 (1 agent)     B0  IMPLEMENT S0+S1+S2     ← PRVO
        ↓
Wave 1 (3 paralelno) A1 Bar · A2 Kitchen · A3 Admin matrix
        ↓
Wave 2 (1 agent)     I0  IMPLEMENT integrator + waiter/fiscal
        ↓
Wave 3 (1 agent)     F0  IMPLEMENT fiscal API S6
        ↓
Parent P0            TI  verify only (bez novog koda)
```

---

## Ko sme dirati šta

| Fajl / folder | Agent |
|---------------|-------|
| `src/lib/auth/*` core | **B0** · **A3** overrides · **I0/F0** guards |
| `src/middleware.ts` | **B0** base · **I0** bar/kitchen redirect |
| `src/app/(bar)/**` | **A1** |
| `src/app/(kitchen)/**` | **A2** |
| `src/app/(waiter)/waiter/**/fiscal` | **I0** |
| admin staff permissions UI | **A3** |
| `supabase/migrations/00110_*` | **A1** |
| `supabase/migrations/00111_*` | **A3** |
| `src/app/api/fiscal/**`, `export/**` | **F0** |

---

## Wave 0 — Agent B0 (COPY-PASTE CEL blok)

```
ADR-024 Wave 0 — Agent B0. IMPLEMENTIRAJ kod (ne samo čitaj ADR).

Tvoj zadatak: implementiraj foundation S0+S1+S2 za Staff Duties & Access u repou /Users/jovicamihajlovic/Desktop/ordering.

KORACI (izvrši redom):
1. Pročitaj docs/architecture/ADR-024-staff-duties-access.md §4–§10 i ADR-024-session-prompts.md §S0–§S2
2. IMPLEMENTIRAJ sve fajlove ispod — kreiraj ih ako ne postoje
3. Pokreni testove i popravi dok ne PASS
4. Session report sa git diff listom

KREIRAJ / IZMENI ove fajlove:

src/lib/auth/permission-catalog.ts
  - PermissionKey union (sve iz ADR-024 §4.1–4.3)
  - PERMISSION_CATALOG sa domain/label/description
  - grupe: OPERATIONS, FISCAL, SURFACE, ADMIN

src/lib/auth/role-templates.ts
  - ROLE_TEMPLATES za waiter, kitchen, staff, manager, owner (bar stub OK)
  - PRIMARY_SURFACE map

src/lib/auth/staff-access.ts
  - resolveStaffAccess(staff, overrides?)
  - can(), assertPermission() → 403
  - computeAllowedSurfaces()

src/lib/auth/require-surface.ts
  - requireSurface('waiter' | 'dashboard' | …) → redirect ako nema pristup

src/lib/auth/load-staff-permission-overrides.ts
  - stub: return [] (A3 kasnije puni DB)

src/lib/auth/staff-modules.ts
  - STAFF_MODULE_REGISTRY skeleton (waiter + dashboard modules)

src/lib/auth/staff-access-context.tsx
  - StaffAccessProvider, useStaffAccess(), useCan()

src/middleware.ts
  - waiter ne sme na /dashboard (redirect /waiter)
  - postojeći login redirect zadrži

src/app/(waiter)/waiter/(app)/layout.tsx
  - zameni WAITER_ALLOWED_ROLES sa requireSurface('waiter')

src/app/(dashboard)/layout.tsx
  - requireSurface('dashboard'), waiter → /waiter

src/__tests__/staff-access.test.ts
  - waiter default permissions
  - waiter + grant fiscal.shift.close
  - revoke payments.collect
  - owner omnipotent

src/__tests__/staff-access-surfaces.test.ts
  - computeAllowedSurfaces unit tests

Hard rules: SA-1 — nema staff.role === u novom kodu osim role-templates.

NE DIRAJ: bar/kitchen routes, admin UI, fiscal API, migracije.

VERIFIKACIJA (mora PASS pre nego što javiš gotovo):
pnpm test:run src/__tests__/staff-access.test.ts src/__tests__/staff-access-surfaces.test.ts
pnpm type-check
pnpm lint
pnpm build

Ne commit-uj. Session report obavezan.
```

---

## Wave 1 — Agent A1 Bar (COPY-PASTE)

```
ADR-024 Wave 1 — Agent A1. IMPLEMENTIRAJ /bar surface (S4).

Prerequisite: B0 je uradio — resolveStaffAccess i requireSurface postoje u src/lib/auth/.

Tvoj zadatak: implementiraj kompletan bar app za šankere.

IMPLEMENTIRAJ:

1. supabase/migrations/00110_bar_staff_role.sql
   - ADD 'bar' to staff.role i staff_invites.role CHECK (kopiraj pattern iz 00083_waiter_role.sql)

2. src/lib/constants.ts — dodaj 'bar' u STAFF_ROLES
3. src/types/database.ts — role union 'bar' ako treba
4. src/lib/auth/role-templates.ts — ROLE_TEMPLATES.bar + PRIMARY_SURFACE bar → '/bar'
   (samo bar delovi; ako conflict sa B0, dodaj minimalno)

5. src/app/(bar)/bar/layout.tsx — bar shell (dark, touch targets, kao waiter)
6. src/app/(bar)/bar/page.tsx — drink order queue
7. src/app/(bar)/bar/(app)/layout.tsx — requireSurface('bar') ako nested pattern
8. src/components/bar/bar-drink-queue.tsx (ili slično) — lista porudžbina filtrirana na drinks/menu_section
9. src/__tests__/staff-access-bar.test.ts — bar template ima orders.read.drinks

Reuse postojeće hooks/API za orders — ne dupliraj order logic.

NE DIRAJ: middleware.ts (I0), kitchen, waiter/fiscal, admin matrix, fiscal API.

VERIFIKACIJA:
pnpm type-check
pnpm test:run src/__tests__/staff-access-bar.test.ts
pnpm build

Ne commit-uj. Session report sa listom novih fajlova.
```

---

## Wave 1 — Agent A2 Kitchen (COPY-PASTE)

```
ADR-024 Wave 1 — Agent A2. IMPLEMENTIRAJ /kitchen standalone KDS (S5 part 1).

Prerequisite: B0 — requireSurface postoji.

Tvoj zadatak: full-screen kitchen app, kitchen staff ne ide na dashboard.

IMPLEMENTIRAJ:

1. src/app/(kitchen)/kitchen/layout.tsx — full-screen, dashboard-theme, visok kontrast
2. src/app/(kitchen)/kitchen/page.tsx — KDS board
3. requireSurface('kitchen') u layout
4. Import/reuse src/components/dashboard/kitchen-board.tsx — NE briši original (manager i dalje može dashboard link kasnije)
5. src/app/(dashboard)/dashboard/kitchen/page.tsx — dodaj redirect na /kitchen za kitchen role ILI banner "open KDS" (minimal diff)
6. src/__tests__/staff-access-kitchen.test.ts — kitchen template, surface kitchen

NE DIRAJ: middleware.ts, bar app, waiter/fiscal, admin matrix, role-templates core, fiscal API.

VERIFIKACIJA:
pnpm type-check
pnpm test:run src/__tests__/staff-access-kitchen.test.ts
pnpm build

Ne commit-uj. Session report.
```

---

## Wave 1 — Agent A3 Admin matrix (COPY-PASTE)

```
ADR-024 Wave 1 — Agent A3. IMPLEMENTIRAJ permission overrides + admin UI (S3).

Prerequisite: B0 — resolveStaffAccess postoji.

Tvoj zadatak: vlasnik može uključiti dozvole po osobi (npr. konobar + Z-Bon).

IMPLEMENTIRAJ:

1. supabase/migrations/00111_staff_permission_overrides.sql
   - tabela staff_permission_overrides (staff_id, permission, granted, granted_by, created_at)
   - RLS: owner/manager staff.manage; staff read own

2. src/lib/auth/load-staff-permission-overrides.ts — PUNI implementacija Supabase query

3. src/lib/auth/staff-access.ts ili getStaffAccess() — učitaj overrides pre resolveStaffAccess

4. src/lib/dashboard/staff-permission-actions.ts
   - setStaffPermissionOverrides(staffId, overrides[])
   - SA-7: manager ne može grant dozvolu koju nema; owner exempt

5. src/components/admin/staff-permissions-grid.tsx
   - checkbox grid grupisan: Operations · Payments · Fiscal · Admin
   - preview: "Logs into: Waiter · Extra: Close shift"

6. Wire u postojeći staff page (admin ili dashboard/staff) — edit permissions na invite/edit

7. src/__tests__/staff-access-overrides.test.ts
   - grant fiscal.shift.close → effective permissions include
   - revoke payments.collect → removed

Pročitaj ADR-001-safe-rollout.md pre migracije.

NE DIRAJ: middleware, bar, kitchen, waiter/fiscal, fiscal API routes.

VERIFIKACIJA:
pnpm test:run src/__tests__/staff-access-overrides.test.ts
pnpm type-check

Ne commit-uj. Session report.
```

---

## Wave 2 — Agent I0 Integrator (COPY-PASTE)

```
ADR-024 Wave 2 — Agent I0. IMPLEMENTIRAJ integraciju A1+A2+A3 + waiter fiscal.

Context: B0, A1 (bar), A2 (kitchen), A3 (overrides) su u workspace-u.

Tvoj zadatak: spoji sve, reši konflikte, implementiraj waiter fiscal modul.

IMPLEMENTIRAJ:

1. src/middleware.ts — login redirect: role bar → /bar, kitchen → /kitchen; block cross-surface

2. src/lib/auth/role-templates.ts — uskladi bar + sve PRIMARY_SURFACE

3. src/lib/auth/staff-modules.ts — KOMPLETAN registry ADR-024 §7:
   waiter: orders, tables, calls, new-order, fiscal-report, fiscal-close, payments
   bar: queue, fiscal-close
   kitchen: kds
   dashboard + admin modules

4. src/app/(waiter)/waiter/(app)/fiscal/page.tsx
   - embed TagesabschlussPanel (reuse iz admin)
   - gate: can('fiscal.shift.close') || can('fiscal.report.daily')

5. src/components/waiter/waiter-bottom-nav.tsx — dodaj More/Fiscal iz module registry

6. src/lib/auth/compliance-guards.ts (NEW stub)
   - fiscal.shift.close requires standalone fiscal mode

7. src/components/dashboard/dashboard-sidebar.tsx — koristi module registry umesto hardcoded WAITER_NAV_HREFS gde moguće

8. docs/architecture/ADR-024-session-prompts.md — status S0–S5 → ✅

NE DIRAJ: src/app/api/fiscal/* (F0).

VERIFIKACIJA:
pnpm test:run src/__tests__/staff-access
pnpm type-check && pnpm lint && pnpm build

Ne commit-uj. Session report.
```

---

## Wave 3 — Agent F0 Fiscal API (COPY-PASTE)

```
ADR-024 Wave 3 — Agent F0. IMPLEMENTIRAJ fiscal API permission migration (S6).

Tvoj zadatak: zameni sve role array check-ove sa assertPermission; dodaj audit.

KORACI:
1. grep -rn 'owner.*manager' src/app/api/fiscal src/app/api/export
2. grep -rn 'requireAdmin|requireFiscalAdmin' src/app/api

IMPLEMENTIRAJ izmene u:

src/app/api/fiscal/daily-closing/route.ts → assertPermission('fiscal.shift.close')
src/app/api/fiscal/daily-closing/[closingId]/z-bon/route.ts → fiscal.shift.read OR fiscal.shift.close
src/app/api/export/dsfinvk/route.ts → fiscal.export.audit
src/app/api/export/datev/route.ts → fiscal.export.accounting
src/app/api/export/csv/route.ts → analytics.read
src/app/api/fiscal/kassenmeldung/route.ts → fiscal.register.manage
src/app/api/fiscal/provision/route.ts → fiscal.register.manage
src/app/api/orders/[orderId]/storno/route.ts → fiscal.storno.execute
src/app/(admin)/admin/tagesabschluss/page.tsx → permission gate umesto requireAdmin

src/lib/auth/compliance-guards.ts — COMPLETE fiscal standalone guard u can()

auditLog() na mutating fiscal handlerima.
Obriši requireFiscalAdmin / requireExportStaff dead helpers.

Grep posle: ne sme ostati ["owner", "manager"] u fiscal/export rutama.

NE DIRAJ: bar/kitchen/waiter UI.

VERIFIKACIJA:
pnpm test:run
pnpm type-check && pnpm lint && pnpm build

Ne commit-uj. Session report.
```

---

## Parent P0 — VERIFY ONLY (ZA TEBE)

```
ADR-024 PARENT P0 — samo VERIFY, bez novog feature koda.

Proveri implementaciju B0+A1+A2+A3+I0+F0:

1. git status + git diff — mora biti stvarnih file changes
2. docs/architecture/ADR-024-verification-checklist.md — sve stavke
3. Pokreni:
   pnpm test:run src/__tests__/staff-access*.test.ts
   pnpm type-check && pnpm lint && pnpm build
4. grep:
   grep -rn 'staff.role ===' src/app/api/fiscal
   grep -rn '\["owner", "manager"\]' src/app/api/fiscal src/app/api/export

Manual checklist:
- waiter → /waiter, blocked /dashboard
- bar → /bar
- kitchen → /kitchen
- owner grants waiter fiscal.shift.close u admin UI
- waiter + close → /waiter/fiscal radi
- POST daily-closing bez dozvole → 403

Ažuriraj status tabelu u ADR-024-session-prompts.md.
Session report PASS/FAIL po stavci. Ne commit-uj osim ako kažem.
```

---

## Brzi redosled

| # | Agent | Akcija |
|---|-------|--------|
| 1 | **B0** | paste Wave 0 blok → čekaj PASS + diff |
| 2 | **A1+A2+A3** | 3 chata paralelno, paste pune blokove |
| 3 | **I0** | paste integrator |
| 4 | **F0** | paste fiscal API |
| 5 | **P0** | ti verify |

---

## Session report template (svaki implement agent)

```markdown
## ADR-024 Agent [B0/A1/…] — IMPLEMENT DONE

### Kreirani/izmenjeni fajlovi (git diff)
- path/to/file.ts

### Verifikacija
| Check | Rezultat |
|-------|----------|
| test:run | PASS/FAIL |
| type-check | PASS/FAIL |
| build | PASS/FAIL |

### Acceptance (agent-specific)
- [ ] …

### Nisam dirao
- middleware / fiscal API / …
```

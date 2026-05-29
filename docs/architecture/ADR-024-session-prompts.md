# ADR-024 — Session Prompts (Staff Duties & Access)

> **Operator (Jovica):** [ADR-024-operator.md](./ADR-024-operator.md) · **Paralelno:** [ADR-024-parallel-agents.md](./ADR-024-parallel-agents.md) — **copy-paste celi blok, agent IMPLEMENTIRA kod**  
> **Review agent:** [ADR-024-verification-checklist.md](./ADR-024-verification-checklist.md)

---

## ⚠️ Implement agenti — obavezno

**Zadatak = radni kod u repou + PASS testovi.** Zabranjeno završiti sesiju samo sa pregledom ADR-a.

Definition of done po track-u: git diff · test:run PASS · type-check · session report.

---

## Obavezna literatura (pročitaj PRE koda)

1. [ADR-024-staff-duties-access.md](./ADR-024-staff-duties-access.md) — surfaces, catalog, SA-1–SA-7, data model
2. [ARCHITECTURE-INDEX.md](./ARCHITECTURE-INDEX.md) — §2.4 Staff access
3. [ADR-011-fiscal-compliance-spine.md](./ADR-011-fiscal-compliance-spine.md) — L5 Compliance surface (S5, S6)
4. [ADR-012-fiscal-journal-spine.md](./ADR-012-fiscal-journal-spine.md) — §8 Z-Bon journal truth (S5, S6)
5. [.cursor/rules/commit-checklist.mdc](../../.cursor/rules/commit-checklist.mdc) — no dead code, grep call sites

**Supabase:** ako diraš DB — [ADR-001-safe-rollout.md](./ADR-001-safe-rollout.md) + [supabase-migration-baseline.md](./supabase-migration-baseline.md).  
**Next migration:** `00110` (bar role) · `00111` (permission overrides) — proveri `ls supabase/migrations/ | tail -3`.

**As-built auth (ne ruši):**

- `src/lib/auth/session.ts` — `getCurrentStaff`, `requireAdmin`, location context
- `src/middleware.ts` — waiter redirect, login routing
- `src/app/(waiter)/waiter/(app)/layout.tsx` — `WAITER_ALLOWED_ROLES`
- `src/app/(dashboard)/layout.tsx` — waiter → `/waiter`
- Fiscal routes — ad-hoc `["owner","manager"]` (migrira S6)

---

## Status implementacije (ažuriraj posle svake sesije)

> **P0 verify 2026-05-29:** B0+A1+A2+A3+I0+F0 — testovi/type-check/build PASS; terminal API → `payments.collect` / `settings.manage`; **pilot smoke u browseru** i dalje na operatoru (login + grant u UI).

| Track | Wave | Status | Ključni deliverable |
|-------|------|--------|---------------------|
| **S0** | B0 | ✅ | `permission-catalog.ts`, `role-templates.ts`, `staff-access.ts`, tests |
| **S1** | B0 | ✅ | `StaffAccessProvider`, `loadStaffPermissionOverrides` |
| **S2** | B0+I0 | ✅ | `middleware-staff-access`, `surface-routing`, `requireSurface`, layouts |
| **S3** | A3 | ✅ | `00111_staff_permission_overrides`, admin permission matrix, SA-7 |
| **S4** | A1 | ✅ | `(bar)/bar/*`, `00110_bar_staff_role` |
| **S5** | A2+I0 | ⚠️ | `(kitchen)/kitchen/*`, `/waiter/fiscal` — **manual pilot smoke pending** |
| **S6** | F0 | ✅ | fiscal/export + terminal → `requireStaffPermission` |
| **S7** | — | 📋 | dual-control, permission audit (opciono) |

---

## Operator checklist (svaka sesija)

1. `git status` + diff — šta već postoji od S-tracka
2. **Tačno jedan track** (S0…S7) — ne mega PR
3. Pre izmene: `grep -rn "resolveStaffAccess\|assertPermission" src/`
4. Posle koda:

```bash
pnpm test:run src/__tests__/staff-access.test.ts   # proširi kad dodaješ testove
pnpm type-check
pnpm lint
pnpm build
```

5. Ako S3/S4/S6: `grep -rn "staff.role ===\|owner.*manager" src/app/api/fiscal src/lib/auth`
6. Session report (template u ADR-024-operator.md)
7. **Ne commit-uj** osim ako operator kaže

---

## S0 — Permission catalog + resolver

### Cilj

Jedan izvor istine za dozvole — bez wire u layout/API (to S2/S6).

### Implementacija

1. **`src/lib/auth/permission-catalog.ts`**
   - Export `PermissionKey` union (sve iz ADR-024 §4.1–4.3)
   - `PERMISSION_CATALOG: Record<PermissionKey, { domain, label, description }>`
   - Group helpers: `OPERATIONS_PERMISSIONS`, `FISCAL_PERMISSIONS`, `SURFACE_PERMISSIONS`, `ADMIN_PERMISSIONS`

2. **`src/lib/auth/role-templates.ts`**
   - `ROLE_TEMPLATES: Record<StaffRole, readonly PermissionKey[]>`
   - `PRIMARY_SURFACE: Record<StaffRole, StaffSurface>`
   - `StaffSurface` = `'waiter' | 'bar' | 'kitchen' | 'dashboard' | 'admin' | 'fiscal'`
   - Owner template = all keys (or wildcard helper `ALL_PERMISSIONS`)

3. **`src/lib/auth/staff-access.ts`**
   - Types: `PermissionOverride`, `StaffAccess`, `AccessContext`
   - `resolveStaffAccess(staff, overrides?)` → effective Set + primarySurface + allowedSurfaces + modules placeholder
   - `can(access, permission, ctx?)` — location scope stub; compliance guards stub (return true until S5/S6)
   - `assertPermission(staff, permission, ctx?)` — load access, throw/`apiError` 403
   - `computeAllowedSurfaces(effective, role)` — primary + surface.* permissions

4. **`src/lib/auth/index.ts`** — re-export public API (optional)

5. **`src/__tests__/staff-access.test.ts`**
   - waiter default: has `orders.read`, no `fiscal.shift.close`
   - waiter + grant `fiscal.shift.close`: effective includes close
   - waiter + revoke `payments.collect`: not in effective
   - owner: all permissions; revoke ignored
   - manager template includes `staff.manage`

### grep acceptance

```bash
grep -rn "ROLE_TEMPLATES\|PERMISSION_CATALOG" src/lib/auth/
pnpm test:run src/__tests__/staff-access.test.ts
```

### Ne raditi u S0

- middleware / layout changes
- DB migration
- admin UI

---

## S1 — Provider + override loader stub

### Cilj

Server/client bridge za layouts (S2) — overrides still empty until S3.

### Implementacija

1. **`loadStaffPermissionOverrides(admin, staffId)`** in `src/lib/auth/load-staff-permission-overrides.ts`
   - Return `[]` until S3 migration exists
   - Type-ready for DB rows

2. **`getStaffAccess(staff)`** — server helper: staff + overrides → `resolveStaffAccess`

3. **`src/lib/auth/staff-access-context.tsx`**
   - `StaffAccessProvider` + `useStaffAccess()` + `useCan(permission)`
   - Pass `StaffAccess` from layout

4. **`src/lib/auth/staff-modules.ts`** (skeleton)
   - `STAFF_MODULE_REGISTRY` array per ADR-024 §7
   - `computeModulesForSurface(access, surface)` — filter by `can()`

5. Tests: `computeModulesForSurface` returns fiscal-close module when permission granted

### Ne raditi u S1

- Wire provider into production layouts yet (optional dev-only page OK)

---

## S2 — Surface guards

### Cilj

**Svako u svoj app** — middleware + layout enforcement.

### Implementacija

1. **`src/middleware.ts`**
   - After auth, load staff role (existing query)
   - Map role → primary surface path (or defer full `resolveStaffAccess` to layout if middleware too heavy — document choice)
   - Block `/dashboard` for `waiter` without cookie/session hint OR redirect always for waiter (match ADR-024 §3.1)
   - Block `/admin` unless role is manager/owner OR future: permission check in layout
   - `/bar`, `/kitchen` routes protected when those route groups exist (stub redirect to login)

2. **`src/lib/auth/require-surface.ts`**
   - `requireSurface(surface: StaffSurface)` — uses `getStaffAccess`, checks `allowedSurfaces`, else redirect primary

3. **Layouts**
   - `(waiter)/waiter/(app)/layout.tsx` — replace `WAITER_ALLOWED_ROLES` with `requireSurface('waiter')`; kitchen still redirect `/kitchen` when S5 exists, else keep `/dashboard/kitchen`
   - `(dashboard)/layout.tsx` — `requireSurface('dashboard')`; keep waiter → `/waiter`
   - `(admin)/admin/layout.tsx` if exists — gate manager/owner or `surface.admin.access`

4. **Complete `staff-modules.ts`** for waiter + dashboard nav mapping (read registry instead of `WAITER_NAV_HREFS` hardcoded set where feasible)

5. **`src/__tests__/staff-access-surfaces.test.ts`** — unit tests for `computeAllowedSurfaces`, redirect decisions

### grep acceptance

```bash
grep -rn "WAITER_ALLOWED_ROLES" src/
# target: only removed or wrapped by requireSurface
grep -rn "requireSurface" src/app/
```

### Ne raditi u S2

- DB migration
- fiscal API changes

---

## S3 — DB overrides + admin permission matrix

### Cilj

Vlasnik dodeljuje dozvole po osobi (npr. konobar + Z-Bon).

### Implementacija

1. **Migration `00111_staff_permission_overrides.sql`**
   - Table per ADR-024 §9.2
   - RLS: staff read own; owner/manager with `staff.manage` manage org staff overrides
   - (If A1 took 00110, use next free number)

2. **`loadStaffPermissionOverrides`** — real Supabase query

3. **Admin UI** — extend `src/components/dashboard/staff-board.tsx` or admin staff page:
   - Permission grid grouped by domain
   - Diff vs template highlighted
   - Preview: primary surface + extra modules

4. **Server actions** `src/lib/dashboard/staff-permission-actions.ts`
   - `setStaffPermissionOverrides(staffId, overrides[])`
   - SA-7: actor must `can('staff.manage')` and only grant permissions they hold (owner exempt)

5. Wire invite flow to save initial overrides from form

6. Tests: DB mock or integration test for effective permissions after override

### Acceptance

Owner grants waiter `fiscal.shift.close` → `getStaffAccess(waiter).permissions` includes key.

---

## S4 — Bar surface

### Cilj

Šanker se uloguje u `/bar` — drink queue only.

### Implementacija

1. **Migration `00110_bar_staff_role.sql`**
   - Extend CHECK on `staff.role` and `staff_invites.role` with `'bar'`
   - Pattern: copy `00083_waiter_role.sql`

2. **Route group `src/app/(bar)/bar/`**
   - `layout.tsx` — `requireSurface('bar')`, shell similar to waiter (dark, touch targets)
   - `page.tsx` — drink order queue
   - `(app)/layout.tsx` if nested pattern matches waiter

3. **`ROLE_TEMPLATES.bar`** — `orders.read.drinks`, `orders.update_status`, `payments.collect`, `orders.create`

4. **middleware** — login redirect `bar` → `/bar`; block bar from `/waiter`

5. **Components** — reuse `KitchenBoard` / orders list patterns with `menu_section` / station filter for drinks

6. **Staff invite UI** — add `bar` to role dropdown (`STAFF_ROLES` in constants)

7. **Types** — `database.ts` Staff role union add `bar`

### Acceptance

Bar staff login → `/bar`; cannot open `/dashboard` without `surface.dashboard.access`.

---

## S5 — Kitchen standalone + waiter fiscal module

### Cilj

Kuhinja full-screen; konobar sa dozvolom zatvara smenu u waiter app-u.

### Implementacija

1. **`src/app/(kitchen)/kitchen/`**
   - Full-screen KDS; `requireSurface('kitchen')`
   - Adapt `src/components/dashboard/kitchen-board.tsx`

2. **Redirects**
   - `kitchen` role → `/kitchen` (middleware + layout)
   - `/dashboard/kitchen` — redirect kitchen role to `/kitchen`; managers keep access via dashboard link + permission

3. **`src/app/(waiter)/waiter/(app)/fiscal/page.tsx`**
   - Embed `TagesabschlussPanel` from admin (shared component)
   - Gate layout: module visible only if `can('fiscal.shift.close')` or `can('fiscal.report.daily')`
   - Read-only report section vs close action separated by permission

4. **`waiter-bottom-nav.tsx`** — add More/Fiscal entry from `staff-modules` registry

5. **`compliance-guards.ts`**
   - `fiscal.shift.close` requires standalone fiscal mode (use `resolveFiscalBehavior`)
   - Wire into `can()`

6. **Admin `/admin/tagesabschluss`** — can stay; also gate with `assertPermission('fiscal.shift.close')` in S6

### Acceptance

Waiter with `fiscal.shift.close` completes Z-Bon from `/waiter/fiscal` without `/admin`.

Manual: `docs/compliance/fiscal-smoke-checklist.md` §3 Z-Bon.

---

## S6 — Fiscal & export API migration

### Cilj

Ukloniti role nizove; jedan permission model na API-ju.

### Implementacija

1. **`src/lib/auth/compliance-guards.ts`** — complete fiscal guards; used by `assertPermission`

2. **Migrate routes** (minimum list):

| Route | Permission |
|-------|------------|
| `POST /api/fiscal/daily-closing` | `fiscal.shift.close` |
| `GET …/z-bon` | `fiscal.shift.read` OR `fiscal.shift.close` |
| `GET /api/export/dsfinvk` | `fiscal.export.audit` |
| `GET /api/export/datev` | `fiscal.export.accounting` |
| `GET /api/export/csv` | `analytics.read` or `fiscal.export.accounting` (pick per product) |
| `POST /api/fiscal/kassenmeldung` | `fiscal.register.manage` |
| `POST /api/fiscal/provision` | `fiscal.register.manage` |
| `POST /api/orders/…/storno` | `fiscal.storno.execute` |
| Terminal, sessions bill/close | `payments.collect`, `sessions.close` per ADR-024 §4.1 |

3. **`auditLog`** on mutating fiscal handlers (reuse `src/lib/audit/log.ts`)

4. Delete `requireFiscalAdmin`, `requireExportStaff` local helpers after migration

5. **`grep` sweep:**

```bash
grep -rn '\["owner", "manager"\]' src/app/api/
grep -rn 'FLOOR_STAFF_ROLES' src/
```

Replace with `assertPermission` where appropriate.

6. Tests: API route tests or staff-access integration for 403 without permission

### Ne raditi u S6

- New surfaces
- DB schema beyond audit if S7 not started

---

## S7 — Enterprise (opciono)

### Cilj

Dual-control Z-Bon; permission change audit trail.

### Implementacija

1. Org setting `fiscal_dual_control_enabled` on `organizations` or location settings
2. Z-Bon POST requires second manager approval token when enabled
3. `staff_permission_audit` append-only table + log on `setStaffPermissionOverrides`

---

## Copy-paste promptovi (kratki)

### S0

```
ADR-024 track S0. Pročitaj ADR-024-session-prompts.md §S0 + ADR-024-staff-duties-access.md §4–§6.
Implement permission catalog, role templates, resolveStaffAccess, staff-access.test.ts.
Bez layout/API wire. pnpm test:run staff-access && pnpm type-check. Session report. Ne commit-uj.
```

### S1

```
ADR-024 track S1. Provider, loadStaffPermissionOverrides stub, staff-modules skeleton, tests.
Pročitaj §S1. Ne commit-uj.
```

### S2

```
ADR-024 track S2. middleware surface guards, requireSurface, layout wire, staff-modules registry.
Pročitaj §S2. pnpm test:run && pnpm type-check && pnpm build. Ne commit-uj.
```

### S3

```
ADR-024 track S3. Migration staff_permission_overrides, admin permission matrix, SA-7 delegation.
Pročitaj §S3 + safe-rollout. Ne commit-uj.
```

### S4

```
ADR-024 track S4. Bar surface /bar, bar role migration, ROLE_TEMPLATES.bar.
Pročitaj §S4. Ne commit-uj.
```

### S5

```
ADR-024 track S5. /kitchen standalone, /waiter/fiscal module, compliance-guards fiscal.shift.close.
Pročitaj §S5 + ADR-012 §8. Ne commit-uj.
```

### S6

```
ADR-024 track S6. Migrate fiscal/export API to assertPermission, auditLog, grep cleanup role arrays.
Pročitaj §S6. Ne commit-uj.
```

### S7

```
ADR-024 track S7. Dual-control Z-Bon + staff_permission_audit. Opciono. Ne commit-uj.
```

---

## Paralelno (više agenta — IMPLEMENT)

**Kompletan plan + puni promptovi:** **[ADR-024-parallel-agents.md](./ADR-024-parallel-agents.md)**

Otvori taj fajl → copy-paste **ceo blok** za agenta (Wave 0–3). Ne šalji skraćeni "pročitaj ADR".

| Wave | Agent | Šta agent IMPLEMENTIRA |
|------|-------|------------------------|
| 0 | B0 | permission catalog, resolver, middleware, tests |
| 1 | A1, A2, A3 | /bar, /kitchen, admin permission grid (paralelno) |
| 2 | I0 | merge + /waiter/fiscal |
| 3 | F0 | fiscal API assertPermission |
| — | P0 (ti) | verify only |

---

## Session report template

Vidi [ADR-024-operator.md](./ADR-024-operator.md) §Session report.

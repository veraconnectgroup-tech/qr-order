# ADR-024 — Verification checklist

Review agent: run after each S-track PR.

---

## Architecture compliance

- [ ] No new `staff.role ===` checks outside `role-templates.ts` / login redirect
- [ ] API and UI use same permission keys from `permission-catalog.ts`
- [ ] `resolveStaffAccess` is single resolver (no duplicate effective-permission logic)
- [ ] Module nav driven by `staff-modules.ts` registry

---

## Surface isolation

- [ ] `waiter` login lands on `/waiter`
- [ ] `waiter` visiting `/dashboard` → redirect `/waiter` (no `surface.dashboard.access`)
- [ ] `bar` login lands on `/bar`
- [ ] `kitchen` login lands on `/kitchen`
- [ ] `manager` can access `/dashboard` and `/admin` (with permissions)

---

## Permission grants

- [ ] Owner can grant `fiscal.shift.close` to waiter via admin matrix
- [ ] Granted waiter sees fiscal module in waiter nav
- [ ] Waiter without grant: fiscal module hidden; API POST daily-closing → 403
- [ ] Revoke `payments.collect` removes pay UI and blocks terminal API
- [ ] Manager cannot grant permission they lack (403)

---

## Fiscal compliance (ADR-011 / ADR-012)

- [ ] `fiscal.shift.close` only when standalone fiscal mode
- [ ] Successful close sets `closed_by` / audit log entry
- [ ] Duplicate close same business_date rejected
- [ ] DSFinV-K requires `fiscal.export.audit`
- [ ] Z-Bon GET requires `fiscal.shift.read` or `fiscal.shift.close` (not kitchen by default)

---

## Regression

- [ ] `pnpm type-check` pass
- [ ] `pnpm test:run src/__tests__/staff-access.test.ts` pass
- [ ] Existing waiter PWA flows (orders, calls, tables) unchanged for default waiter
- [ ] Owner admin flows unchanged

---

## Manual smoke (pilot venue)

1. Invite waiter → login → only waiter app modules
2. Grant close shift → Z-Bon from `/waiter/fiscal`
3. Bar staff → drinks queue only
4. Kitchen → KDS only, no admin sidebar

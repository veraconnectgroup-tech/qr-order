# POS Speed — Verification Checklist (Parent P0)

> **Kada:** posle P0+P1+P2 (+ P3 opciono) — **ti (Jovica)** ili review agent.  
> **Arhitektura:** [POS-SPEED-ARCHITECTURE.md](./POS-SPEED-ARCHITECTURE.md)

---

## 1. Automatski gate-ovi

```bash
pnpm test:run src/__tests__/pos-speed*.test.ts src/__tests__/staff-order*.test.ts
pnpm type-check
pnpm lint
pnpm build
```

Ako test fajlovi ne postoje — agent ih nije napisao; **FAIL** za P1+.

---

## 2. grep — fiskal (obavezno PASS)

Staff order create **ne sme** enqueue-ovati TSE:

```bash
grep -rn "fiscal.tse_sign" src/lib/outbox/build-outbox-events.ts
# FC-2 comment + no enqueue at phase created

grep -rn "persistOrderSideEffects\|createStaffOrder" src/lib/orders/create-staff-order.ts
# side effects deferred (P0+) — not blocking return before response
```

```bash
pnpm test:run src/__tests__/outbox.test.ts
# buildOutboxEvents created phase excludes fiscal.tse_sign
```

---

## 3. grep — nema duplog order engine-a

```bash
grep -rn "create_staff_order" src/
# samo create-staff-order.ts + migration + types — nema paralelnog create path

grep -rn "scheduleOrderTseSign\|scheduleNewOrderPush" src/lib/orders/
# mora biti 0 (outbox only)
```

---

## 4. P0 acceptance

| # | Check | PASS? |
|---|-------|-------|
| P0-1 | `persistOrderSideEffects` ne blokira HTTP response (`after()` ili ekvivalent) | |
| P0-2 | Table/location/org fetch paralelizovan u `create-staff-order.ts` | |
| P0-3 | `staff-order-entry`: nema duplog toast-a; nema `router.push("/dashboard/orders")` sa `/waiter` | |
| P0-4 | `submitting` ne blokira dugme duže nego lokalni enqueue (P1) ili odmah (P0 partial) | |

---

## 5. P1 acceptance (M1 local-first)

| # | Check | PASS? |
|---|-------|-------|
| P1-1 | Migration `00112_staff_order_idempotency.sql` postoji + RLS | |
| P1-2 | `clientOrderId` u schema + API; dupli POST → isti order (200) | |
| P1-3 | Online path: IndexedDB write **pre** network; cart clear <100 ms | |
| P1-4 | Shared tax calc — client koristi istu logiku kao `vat.ts` (test fixture) | |
| P1-5 | `verifyTableStillValid` preskočen kad `POS_LOCAL_FIRST` | |
| P1-6 | Sync badge / pending count u waiter shell ili banner | |
| P1-7 | Card terminal i dalje online-only (nema offline queue) | |
| P1-8 | Feature flag `isPosLocalFirstEnabled(locationId)` | |

---

## 6. P2 acceptance (M2 kitchen provisional)

| # | Check | PASS? |
|---|-------|-------|
| P2-1 | Waiter šalje broadcast posle lokalnog WAL write | |
| P2-2 | KDS/kitchen merge provisional + server rows po `clientOrderId` | |
| P2-3 | Provisional UI: orange / „SYNC…“; confirmed: normal | |
| P2-4 | Provisional auto-hide posle 30 s bez server row | |
| P2-5 | KDS **ne** auto-printa provisional | |
| P2-6 | Denis signal **ne** ide iz provisional — samo posle server commit | |

---

## 7. P3 acceptance (polish)

| # | Check | PASS? |
|---|-------|-------|
| P3-1 | Staff create → `scheduleDenisWorldSignal` (parity guest) | |
| P3-2 | Trust UI: Snimljeno → Kuhinja → Potvrđeno #N (copy DE) | |
| P3-3 | Conflict state za unavailable products | |

---

## 8. Manual smoke (pilot)

1. Login waiter → `/waiter/new-order`
2. Dodaj stavke → Order → **cart odmah prazan** (<1 s osećaj)
3. KDS/kitchen: vidi narandžastu karticu → zelenu posle sync
4. Offline (DevTools): order se snimi; sync na online
5. Dupli tap brzo: **jedna** porudžbina u DB
6. Card terminal: offline → error (ne queue)

---

## 9. Session report template

```markdown
## POS Speed Parent Verify — [date]

| Track | Auto tests | grep fiscal | Manual smoke |
|-------|------------|-------------|--------------|
| P0 | | | |
| P1 | | | |
| P2 | | | |
| P3 | | | |

Gaps fixed: ...
Ready for pilot: YES/NO
```

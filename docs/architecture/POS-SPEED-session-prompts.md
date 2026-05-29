# POS Speed — Session Prompts (Vera Maximum POS)

> **Operator:** [POS-SPEED-operator.md](./POS-SPEED-operator.md) · **Copy-paste agenti:** [POS-SPEED-parallel-agents.md](./POS-SPEED-parallel-agents.md)  
> **Review:** [POS-SPEED-verification-checklist.md](./POS-SPEED-verification-checklist.md)  
> **Arhitektura:** [POS-SPEED-ARCHITECTURE.md](./POS-SPEED-ARCHITECTURE.md)

---

## ⚠️ Implement agenti — obavezno

**Zadatak = radni kod + PASS testovi.** Zabranjeno završiti sesiju samo sa summary-jem.

Definition of done: git diff · `pnpm test:run` · `pnpm type-check` · `pnpm lint` · `pnpm build` · session report.

---

## Obavezna literatura (pročitaj PRE koda)

1. [POS-SPEED-ARCHITECTURE.md](./POS-SPEED-ARCHITECTURE.md) — M1+M2 target, tradeoffs, fiscal rules
2. [.cursor/rules/commit-checklist.mdc](../../.cursor/rules/commit-checklist.mdc) — no duplicate side effects, grep call sites
3. [ADR-001-implementation-warnings.md](./ADR-001-implementation-warnings.md) — outbox, idempotency
4. [ADR-011-fiscal-compliance-spine.md](./ADR-011-fiscal-compliance-spine.md) — TSE samo na plaćanje

**Next migration:** `00112` — proveri `ls supabase/migrations/ | tail -3`

**Ključni fajlovi (as-built):**

| Fajl | Uloga |
|------|-------|
| `src/components/dashboard/staff-order-entry.tsx` | Waiter submit UX |
| `src/app/api/staff-orders/route.ts` | API entry |
| `src/lib/orders/create-staff-order.ts` | Server validation + RPC |
| `src/lib/outbox/persist-order-side-effects.ts` | Side effects (P0: defer) |
| `src/lib/offline/order-queue.ts` | IndexedDB |
| `src/lib/offline/sync-manager.ts` | Background sync |
| `src/lib/tax/vat.ts` | Tax — extract shared pure fn za client |
| `src/hooks/use-kds-orders.ts` | KDS (P2: provisional merge) |
| `src/hooks/use-kitchen-orders.ts` | Kitchen board (P2) |
| `supabase/migrations/00082_create_staff_order_tx.sql` | Atomic RPC — **ne zamenjuj** u P0–P2 |

---

## Status implementacije (ažuriraj posle sesije)

| Track | Status | Deliverable |
|-------|--------|-------------|
| **P0** | 📋 | defer outbox, parallel queries, UI fixes |
| **P1** | 📋 | M1 local-first, idempotency 00112, menu cache |
| **P2** | 📋 | M2 provisional broadcast + KDS merge |
| **P3** | 📋 | Denis staff signal, trust UI, conflict polish |

---

## Operator checklist (svaka sesija)

1. `git status` — proveri šta P-track već postoji
2. **Tačno jedan track** (P0…P3) — ne mega PR
3. Pre izmene: `grep -rn "createStaffOrder\|persistOrderSideEffects" src/`
4. Posle koda:

```bash
pnpm test:run src/__tests__/pos-speed*.test.ts   # dodaj testove po track-u
pnpm type-check
pnpm lint
pnpm build
```

5. Fiscal grep: `grep -rn "fiscal.tse_sign" src/lib/outbox/build-outbox-events.ts`
6. **Ne commit-uj** osim ako operator kaže

---

## P0 — Server quick wins + UI fixes

### Cilj

~30–50% brže **bez** local-first flag-a. Mali rizik. Priprema teren za P1.

### Implementacija

#### 1. Defer `persistOrderSideEffects` (API route)

U `src/app/api/staff-orders/route.ts` (ili helper u `create-staff-order.ts`):

- Posle uspešnog RPC-a, **vrati response odmah**
- Side effects u `after()` iz `next/server` ILI `void persistOrderSideEffects(...).catch(logger.error)`
- **Ne dupliraj** side effects — samo pomeri await sa critical path-a
- Error log obavezan — outbox mora biti observabilan

#### 2. Parallelize queries u `create-staff-order.ts`

- `Promise.all` za table + location (location koristi table.location_id nakon table fetch — ili jedan join query)
- `Promise.all` za products + categories (categories needs product category_ids — batch after products)
- Modifiers: skip group query when `modifierIds.length === 0`

#### 3. UI fixes — `staff-order-entry.tsx`

- Ukloni **dupli** toast (ostavi jedan flow)
- Sa `/waiter`: success → ostani na new-order ili `router.push("/waiter/orders")` — **ne** `/dashboard/orders`
- Sa `/dashboard/new-order`: zadrži dashboard navigaciju
- Detektuj pathname (`usePathname`) ili prop `successRedirect`

#### 4. Testovi

- `src/__tests__/pos-speed-p0.test.ts` — minimal: buildOutboxEvents created phase nema TSE; optional mock defer behavior

### grep acceptance

```bash
grep -rn "after(\|void persistOrderSideEffects" src/app/api/staff-orders src/lib/orders/create-staff-order.ts
pnpm test:run src/__tests__/pos-speed-p0.test.ts
pnpm build
```

### Ne raditi u P0

- Migration / clientOrderId
- Local-first always enqueue
- Broadcast / KDS provisional
- Menjati `create_staff_order_tx` RPC

---

## P1 — M1 Local-first PWA

### Cilj

Konobar tap → cart clear **<50 ms**. Idempotent sync. Feature flag.

### Implementacija

#### 1. Feature flags — `src/lib/pos/feature-flags.ts`

```typescript
export function isPosLocalFirstEnabled(locationId: string): boolean
export function isPosKitchenProvisionalEnabled(locationId: string): boolean // stub false until P2
```

- Env: `POS_LOCAL_FIRST=true`, opciono `POS_LOCAL_FIRST_LOCATIONS=uuid,uuid`
- Default false — safe rollout

#### 2. Migration `00112_staff_order_idempotency.sql`

```sql
CREATE TABLE staff_order_idempotency (
  client_order_id UUID PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES staff(id),
  location_id UUID NOT NULL REFERENCES locations(id),
  order_id UUID NOT NULL REFERENCES orders(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- RLS: service role only (API uses admin client)
-- index on staff_id, created_at for cleanup
```

#### 3. API schema — `create-staff-order.ts`

Extend `createStaffOrderSchema`:

```typescript
clientOrderId: zUuid().optional(), // required when POS_LOCAL_FIRST
menuVersion: z.string().optional(),
```

Flow:

1. Ako `clientOrderId` postoji → lookup idempotency → return existing order 200
2. Normal create → insert idempotency row posle RPC

#### 4. Shared tax — `src/lib/tax/compute-staff-order-totals.ts`

- Pure fn: menu products + cart items → subtotal, tax, total
- Koristi `resolveItemTaxRate`, `calculateOrderTaxFromItems` iz `vat.ts`
- Unit test: fixture menu — client fn === server validation rezultat

#### 5. Extend `order-queue.ts`

- Dodaj polja: `clientOrderId`, `menuVersion`, `clientSnapshot`, status `conflict`
- `enqueueStaffOrder` uvek generiše/koristi clientOrderId

#### 6. `src/lib/offline/staff-order-submit.ts` (novi)

Orchestrator za local-first submit:

1. Validate cart locally
2. Compute totals
3. Write IDB
4. Clear cart + toast „Snimljeno ✓“
5. `void syncQueuedStaffOrders()` — non-blocking

#### 7. `staff-order-entry.tsx`

Kad `isPosLocalFirstEnabled(locationId)`:

- **Uvek** IDB first (online i offline)
- **Ne** pozivaj `verifyTableStillValid()` pre submit
- **Ne** drži `submitting` za network
- Background sync šalje `clientOrderId` u payload
- Na sync success: toast „Potvrđeno #N“
- Na conflict: toast + badge (basic — P3 polish)

Kad flag off: zadrži stari path (ali P0 UI fixes ostaju).

#### 8. Menu cache — `src/lib/offline/menu-cache.ts`

- Persist categories+products snapshot + `menuVersion` (max updated_at) u IndexedDB
- Load on mount pre Supabase fetch (stale-while-revalidate)

#### 9. Sync manager

- Payload uključuje `clientOrderId`
- Na 200 sa postojećim order — treat as success, remove from queue

#### 10. Waiter pending UI

- `ConnectionBanner` ili mali badge: pending sync count (`subscribeSyncState`)

#### 11. Testovi

- `src/__tests__/pos-speed-p1-idempotency.test.ts`
- `src/__tests__/pos-speed-p1-tax-parity.test.ts`

### grep acceptance

```bash
grep -rn "clientOrderId\|staff_order_idempotency" src/
grep -rn "isPosLocalFirstEnabled" src/
pnpm test:run src/__tests__/pos-speed-p1*.test.ts
```

### Ne raditi u P1

- Supabase broadcast (P2)
- KDS merge UI (P2)
- `create_staff_order_fast_tx` (P3+ optional)
- Denis signal (P3)

---

## P2 — M2 Kitchen provisional

### Cilj

Kuhinja vidi porudžbinu ~100–300 ms posle tap-a. Trust state 2.

### Implementacija

#### 1. Contract — `src/lib/pos/provisional-types.ts`

```typescript
export type ProvisionalOrderPayload = {
  clientOrderId: string;
  locationId: string;
  tableId: string;
  tableName: string;
  staffId: string;
  items: Array<{ productName: string; quantity: number; notes?: string }>;
  total: number;
  createdAt: string;
};

export type PosBroadcastEvent =
  | { type: "provisional_order"; payload: ProvisionalOrderPayload }
  | { type: "order_confirmed"; clientOrderId: string; orderId: string; orderNumber: number }
  | { type: "order_conflict"; clientOrderId: string; reason: string };
```

Channel: `pos:location:{locationId}`

#### 2. Emit — `src/lib/pos/provisional-broadcast.ts`

- `subscribePosChannel(locationId, onEvent)` — KDS/kitchen
- `broadcastProvisionalOrder(supabase, payload)` — waiter
- `broadcastOrderConfirmed(...)` — posle sync success u sync-manager ili staff-order-submit
- Koristi Supabase Realtime Broadcast (`channel.send({ type: 'broadcast', event, payload })`)
- Guard: samo authenticated staff; payload locationId mora match session

#### 3. Waiter integrate

U `staff-order-submit.ts` posle IDB write:

- ako `isPosKitchenProvisionalEnabled` → broadcast provisional

U sync success handler:

- broadcast `order_confirmed`

Na conflict:

- broadcast `order_conflict`

#### 4. KDS — `use-kds-orders.ts`

- State: `provisionalOrders: Map<clientOrderId, ProvisionalOrderPayload>`
- Subscribe pos channel u useEffect
- Merge u display list: provisional first, replace kad server row sa matching id ili order appears within window
- **30 s timeout** — remove provisional bez confirm

#### 5. Kitchen — `use-kitchen-orders.ts`

Isti pattern kao KDS (shared hook `use-provisional-orders.ts` optional).

#### 6. UI — `kds-board.tsx`, `kitchen-board.tsx`

- Provisional card: orange border, badge „SYNC…“
- Sound on new provisional (reuse existing new-order sound logic)
- **Ne** trigger auto-print za provisional

#### 7. Feature flag

- `POS_KITCHEN_PROVISIONAL=true` + `isPosKitchenProvisionalEnabled`

#### 8. Testovi

- `src/__tests__/pos-speed-p2-provisional-merge.test.ts` — pure merge logic

### grep acceptance

```bash
grep -rn "provisional_order\|ProvisionalOrderPayload" src/
grep -rn "scheduleDenisWorldSignal" src/lib/orders/create-staff-order.ts
# Denis NE SME biti u provisional path
pnpm test:run src/__tests__/pos-speed-p2*.test.ts
```

### Ne raditi u P2

- Denis world signal (P3)
- Fast RPC migration
- Auto-print provisional

---

## P3 — Denis parity + trust UI polish

### Cilj

Staff orders u Denis brain. Tri faze poverenja u UI. Conflict sheet.

### Implementacija

#### 1. Denis signal na staff create

U deferred side effects path (P0 pattern) — posle `persistOrderSideEffects`:

```typescript
scheduleDenisWorldSignal({
  signal: "commerce.order_created",
  orderId,
  sessionId,
  status: "pending",
});
```

- Isti pattern kao `src/lib/orders/create/pipeline/emit-side-effects.ts` (guest)
- **Samo posle server commit** — nikad iz provisional broadcast

#### 2. Trust UI — `staff-order-entry.tsx` / mali `PosTrustIndicator`

States:

1. Snimljeno ✓ (local)
2. Kuhinja vidi ✓ (posle broadcast ack optional / timeout 2s assume)
3. Potvrđeno #127 ✓ (server)

Copy DE za pilot.

#### 3. Conflict UX

- Sheet/dialog kad sync vrati `unavailable_products`
- Opcije: ukloni stavku / otkaži / retry

#### 4. Test

- `src/__tests__/pos-speed-p3-denis-staff.test.ts` — mock scheduleDenisWorldSignal called once on staff path

---

## P4 (opciono kasnije) — Fast RPC

**Ne raditi u prvom valu.** Tek ako p95 sync >500 ms posle P1+P2.

- `00113_create_staff_order_fast_tx.sql`
- Redis menu cache
- Outbox via DB trigger

Vidi POS-SPEED-ARCHITECTURE.md §5.5 P3 server phase.

---

## Reference — env flags

| Env | Track |
|-----|-------|
| `POS_LOCAL_FIRST=true` | P1 |
| `POS_LOCAL_FIRST_LOCATIONS=uuid,...` | P1 pilot |
| `POS_KITCHEN_PROVISIONAL=true` | P2 |
| `POS_SKIP_PREFLIGHT=true` | optional alias P1 |

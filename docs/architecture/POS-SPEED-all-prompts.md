# POS Speed — SVI PROMPTOVI (copy-paste)

> **Jedan fajl — sve nalepi agentima redom.**  
> Arhitektura: [POS-SPEED-ARCHITECTURE.md](./POS-SPEED-ARCHITECTURE.md) · Verify: [POS-SPEED-verification-checklist.md](./POS-SPEED-verification-checklist.md) · Detalj scope: [POS-SPEED-session-prompts.md](./POS-SPEED-session-prompts.md)

---

## Redosled

```
P0 → P1 → P2 (ili P2A+P2B) → P3 → Parent verify → [Fix] → [MIG] → Commit
```

**Pilot env (posle P1/P2):**
```bash
POS_LOCAL_FIRST=true
POS_KITCHEN_PROVISIONAL=true
# POS_LOCAL_FIRST_LOCATIONS=uuid1,uuid2
```

---

## Pravilo (svaki implement agent)

```
ZADATAK = IMPLEMENTIRAJ RADNI KOD u repou + pokreni testove.

✅ OBAVEZNO: kreiraj/izmeni fajlove, type-check, test:run, lint, build
❌ ZABRANJENO: završiti sesiju samo sa summary-jem
❌ ZABRANJENO: drugi order engine / client TSE / dirati fiscal timing

Definition of done:
1. git diff pokazuje fajlove iz scope-a
2. navedeni testovi PASS
3. session report (template na dnu ovog fajla)
4. Ne commit-uj osim ako operator kaže
```

---

## Operator one-lineri (Jovica)

**Sledeći track automatski:**
```
POS Speed operator mode. Pročitaj docs/architecture/POS-SPEED-all-prompts.md i uradi sledeći nedovršeni track (P0→P3). IMPLEMENTIRAJ kod + testovi PASS. Session report. Ne commit-uj osim ako kažem.
```

**Paralelno Wave 2:**
```
POS Speed Wave 2 paralelno — pošalji OBA agenta P2A i P2B iz POS-SPEED-all-prompts.md. Posle oba: Parent verify.
```

---

# AGENT P0

```
POS Speed Wave 0 — Agent P0. IMPLEMENTIRAJ kod (ne samo čitaj doc).

Repo: /Users/jovicamihajlovic/Desktop/ordering

CILJ: Server quick wins + UI fixes (~30–50% brže). BEZ local-first flag-a. BEZ migration.

KORACI:
1. Pročitaj docs/architecture/POS-SPEED-ARCHITECTURE.md §2 + §5.5 P0
2. Pročitaj docs/architecture/POS-SPEED-session-prompts.md §P0
3. Pročitaj .cursor/rules/commit-checklist.mdc
4. IMPLEMENTIRAJ sve ispod
5. Pokreni gate-ove dok PASS

FAJL 1: src/lib/orders/create-staff-order.ts
- Parallelize DB fetches gde je bezbedno (table/location/org; products/categories)
- Skip modifier_groups query kad nema modifiera
- NE menjaj create_staff_order_tx RPC
- Side effects: pripremi return pre outbox-a — outbox ide van critical path (FAJL 2)

FAJL 2: src/app/api/staff-orders/route.ts
- Posle uspešnog createStaffOrder: vrati apiSuccess ODMAH
- persistOrderSideEffects pozovi u after() iz 'next/server' ILI void .catch(logger)
- Jedan side-effect path — ne dupliraj schedule* funkcije

FAJL 3: src/components/dashboard/staff-order-entry.tsx
- Ukloni dupli toast na success path
- usePathname(): /waiter/* success → /waiter/orders ili ostani; NE /dashboard/orders
- /dashboard/new-order → zadrži dashboard redirect

FAJL 4: src/__tests__/pos-speed-p0.test.ts
- Assert buildOutboxEvents('created') ne uključuje fiscal.tse_sign (import postojeći test pattern)

GREP pre commit-a:
grep -rn "scheduleOrderTseSign\|scheduleNewOrderPush" src/lib/orders/
# mora biti 0

GATE:
pnpm test:run src/__tests__/pos-speed-p0.test.ts src/__tests__/outbox.test.ts
pnpm type-check
pnpm lint
pnpm build

Session report. Ne commit-uj.
```

---

# AGENT P1

```
POS Speed Wave 1 — Agent P1. IMPLEMENTIRAJ M1 Local-first PWA.

Repo: /Users/jovicamihajlovic/Desktop/ordering
PREUSLOV: P0 merged ili već u branch-u.

CILJ: Konobar tap → IndexedDB → cart clear <50ms. Idempotent sync. Feature flag.

KORACI:
1. Pročitaj docs/architecture/POS-SPEED-ARCHITECTURE.md §5.3 + §5.5 L3
2. Pročitaj docs/architecture/POS-SPEED-session-prompts.md §P1
3. ls supabase/migrations/ | tail -3  → sledeći broj: 00112

KREIRAJ / IZMENI:

supabase/migrations/00112_staff_order_idempotency.sql
  - staff_order_idempotency table (client_order_id PK, staff_id, location_id, order_id)
  - RLS service-role only

src/lib/pos/feature-flags.ts
  - isPosLocalFirstEnabled(locationId) — env POS_LOCAL_FIRST, POS_LOCAL_FIRST_LOCATIONS

src/lib/tax/compute-staff-order-totals.ts
  - pure fn koristi resolveItemTaxRate + calculateOrderTaxFromItems
  - export types za cart snapshot

src/lib/offline/menu-cache.ts
  - persist/load menu + menuVersion u IndexedDB

src/lib/offline/order-queue.ts
  - extend StaffOrderQueueItem: clientOrderId, menuVersion, clientSnapshot, status conflict

src/lib/offline/staff-order-submit.ts
  - orchestrator: compute → enqueue → clear cart → toast → void syncQueuedStaffOrders()

src/lib/offline/sync-manager.ts
  - payload šalje clientOrderId; handle idempotent 200

src/lib/orders/create-staff-order.ts
  - schema: clientOrderId optional/required under flag
  - lookup idempotency pre create; insert posle RPC

src/components/dashboard/staff-order-entry.tsx
  - kad isPosLocalFirstEnabled: uvek staff-order-submit path
  - skip verifyTableStillValid
  - ne blokiraj submitting za network

src/components/dashboard/connection-banner.tsx (ili waiter shell)
  - prikaži pending sync count iz subscribeSyncState

src/__tests__/pos-speed-p1-idempotency.test.ts
src/__tests__/pos-speed-p1-tax-parity.test.ts

NE RADITI:
- Supabase broadcast (P2)
- Denis signal (P3)
- create_staff_order_fast_tx

GATE:
pnpm test:run src/__tests__/pos-speed-p1*.test.ts
pnpm type-check
pnpm lint
pnpm build

Session report + env vars za pilot. Ne commit-uj.
```

---

# AGENT P2 (jedan integrator)

```
POS Speed Wave 2 — Agent P2. IMPLEMENTIRAJ M2 Kitchen provisional.

Repo: /Users/jovicamihajlovic/Desktop/ordering
PREUSLOV: P1 PASS.

CILJ: Kuhinja vidi narandžastu provisional karticu ~100–300ms posle tap. 30s timeout.

KORACI:
1. Pročitaj docs/architecture/POS-SPEED-ARCHITECTURE.md §5.4
2. Pročitaj docs/architecture/POS-SPEED-session-prompts.md §P2

KREIRAJ:

src/lib/pos/provisional-types.ts
  - ProvisionalOrderPayload, PosBroadcastEvent union

src/lib/pos/provisional-broadcast.ts
  - channel pos:location:{locationId}
  - broadcastProvisionalOrder, broadcastOrderConfirmed, broadcastOrderConflict
  - subscribePosChannel(locationId, handler)
  - Supabase Realtime Broadcast API

src/lib/pos/feature-flags.ts (extend)
  - isPosKitchenProvisionalEnabled — POS_KITCHEN_PROVISIONAL env

IZMENI:

src/lib/offline/staff-order-submit.ts
  - posle IDB: broadcast provisional ako flag

src/lib/offline/sync-manager.ts
  - posle sync OK: broadcast order_confirmed
  - posle conflict: broadcast order_conflict

src/hooks/use-provisional-pos-orders.ts (novi shared hook)
  - subscribe + Map state + 30s auto-remove

src/hooks/use-kds-orders.ts
  - merge provisional + server orders za display

src/hooks/use-kitchen-orders.ts
  - isto merge

src/components/dashboard/kds-board.tsx
  - orange border + SYNC badge; sound na novi provisional; NO auto-print

src/components/dashboard/kitchen-board.tsx
  - isto

src/__tests__/pos-speed-p2-provisional-merge.test.ts
  - pure merge/timeout logic

PRAVILA:
- Denis signal NE SME iz broadcast path-a
- KDS ne štampa provisional
- Staff JWT required za broadcast

GATE:
pnpm test:run src/__tests__/pos-speed-p2*.test.ts
pnpm type-check
pnpm lint
pnpm build

Session report. Ne commit-uj.
```

---

# AGENT P2A (opciono — samo emit)

```
POS Speed Wave 2A — provisional EMIT. PREUSLOV: P1 PASS.

Repo: /Users/jovicamihajlovic/Desktop/ordering

Scope SAMO:
- src/lib/pos/provisional-types.ts (KREIRAJ — contract za P2B)
- src/lib/pos/provisional-broadcast.ts
- src/lib/pos/feature-flags.ts (kitchen flag)
- src/lib/offline/staff-order-submit.ts (broadcast call)
- src/lib/offline/sync-manager.ts (confirmed/conflict broadcast)

NE diraj KDS/kitchen hooks.

Gate: type-check + lint + build

Session report. Ne commit-uj.
```

---

# AGENT P2B (opciono — samo KDS)

```
POS Speed Wave 2B — provisional KDS CONSUME. PREUSLOV: P2A types postoje.

Repo: /Users/jovicamihajlovic/Desktop/ordering

Scope SAMO:
- src/hooks/use-provisional-pos-orders.ts
- src/hooks/use-kds-orders.ts
- src/hooks/use-kitchen-orders.ts
- src/components/dashboard/kds-board.tsx
- src/components/dashboard/kitchen-board.tsx
- src/__tests__/pos-speed-p2-provisional-merge.test.ts

Koristi ProvisionalOrderPayload iz src/lib/pos/provisional-types.ts — ne menjaj contract.

GATE:
pnpm test:run src/__tests__/pos-speed-p2*.test.ts
pnpm type-check
pnpm lint
pnpm build

Session report. Ne commit-uj.
```

---

# AGENT P3

```
POS Speed Wave 3 — Agent P3. Denis parity + trust UI polish.

Repo: /Users/jovicamihajlovic/Desktop/ordering
PREUSLOV: P2 PASS.

CILJ: Staff order → scheduleDenisWorldSignal posle server commit. Trust UI 3 faze. Conflict sheet.

KORACI:
1. Pročitaj docs/architecture/POS-SPEED-session-prompts.md §P3
2. Pattern: src/lib/orders/create/pipeline/emit-side-effects.ts (guest)

IZMENI:

src/lib/orders/create-staff-order.ts ILI deferred side-effects helper
  - posle persistOrderSideEffects: scheduleDenisWorldSignal({ signal: 'commerce.order_created', orderId, sessionId, status: 'pending' })
  - SAMO posle server commit — grep da nema u staff-order-submit / broadcast

src/components/dashboard/staff-order-entry.tsx
  - PosTrustIndicator ili inline: Snimljeno → Kuhinja → Potvrđeno #N (DE copy)
  - Conflict dialog za unavailable_products (sync failure path)

src/__tests__/pos-speed-p3-denis-staff.test.ts
  - mock: staff create poziva scheduleDenisWorldSignal jednom

NE RADITI:
- fiscal pipeline changes
- create_staff_order_fast_tx

GATE:
pnpm test:run src/__tests__/pos-speed-p3*.test.ts
pnpm type-check
pnpm lint
pnpm build

Session report. Ne commit-uj.
```

---

# PARENT VERIFY (ti)

```
POS Speed Parent verify. Repo: /Users/jovicamihajlovic/Desktop/ordering

1. Pročitaj docs/architecture/POS-SPEED-verification-checklist.md
2. Pokreni sve gate-ove §1
3. grep fiscal §2 — mora PASS
4. Popuni acceptance tabele P0–P3
5. Manual smoke §8 (waiter + KDS + offline + dupli tap)
6. Ako FAIL — popravi ili delegiraj FIX agentu

Session report: Ready for pilot YES/NO. Ne commit-uj osim fixeva.
```

---

# AGENT FIX (kad verify FAIL)

```
POS Speed FIX agent. Parent verify je FAIL.

Repo: /Users/jovicamihajlovic/Desktop/ordering

FAIL stavke (popuni):
- [npr. P1-3: cart se ne čisti odmah]
- [npr. P2-4: nema 30s timeout]

1. Pročitaj POS-SPEED-verification-checklist.md
2. Pročitaj session report prethodnog agenta
3. POPRAVI SAMO gapove — minimalan diff
4. Ne diraj src/lib/fiscal/*
5. Ne uvodi drugi order engine

GATE:
pnpm test:run src/__tests__/pos-speed*.test.ts src/__tests__/outbox.test.ts
pnpm type-check && pnpm lint && pnpm build

Session report. Ne commit-uj.
```

---

# AGENT MIG (opciono — posle P1)

```
POS Speed — Agent MIG. SAMO Supabase migracija 00112.

Repo: /Users/jovicamihajlovic/Desktop/ordering

1. Pročitaj docs/architecture/ADR-001-safe-rollout.md + supabase-migration-baseline.md
2. Proveri da 00112_staff_order_idempotency.sql postoji od P1 agenta
3. Ako ne postoji — kreiraj po POS-SPEED-session-prompts.md §P1
4. NE diraj druge migracije; NE db reset na remote
5. Session report: SQL sadržaj + rollback komentar

Ne push-uj remote osim ako operator kaže.
```

---

# AGENT COMMIT (posle Parent PASS)

```
Commituj kompletan POS Speed rad (P0–P3) jednim ili više commit-a po track-u.

Repo: /Users/jovicamihajlovic/Desktop/ordering

1. git status + git diff
2. Pročitaj git log -5 za commit message stil
3. Ne commit-uj .env / secrets
4. Commit message fokus na WHY (local-first POS, kitchen provisional)
5. Ne push-uj

Pre commit-a:
grep -rn "scheduleOrderTseSign\|scheduleNewOrderPush" src/lib/orders/
pnpm test:run src/__tests__/pos-speed*.test.ts && pnpm type-check && pnpm lint && pnpm build
```

---

# AGENT P4 (KASNIJE — samo ako pilot kasni)

```
POS Speed P4 — SAMO ako pilot p95 sync >500ms posle P1+P2.

Repo: /Users/jovicamihajlovic/Desktop/ordering

Pročitaj POS-SPEED-ARCHITECTURE.md §5.5 + POS-SPEED-session-prompts.md §P4.
Implementiraj create_staff_order_fast_tx + Redis menu cache.
Jedan PR. Ne diraj fiscal. Session report. Ne commit-uj.
```

---

## Session report (agent popunjava)

```markdown
## POS Speed — Track P[X]

| Gate | Result |
|------|--------|
| git diff u scope-u | |
| pnpm test:run | PASS/FAIL |
| pnpm type-check | PASS/FAIL |
| pnpm lint | PASS/FAIL |
| pnpm build | PASS/FAIL |

### Fajlovi
- ...

### Feature flags
- POS_LOCAL_FIRST / POS_KITCHEN_PROVISIONAL: ...

### Fiscal regression
- staff create outbox excludes fiscal.tse_sign: YES/NO

### Notes / blockers
```

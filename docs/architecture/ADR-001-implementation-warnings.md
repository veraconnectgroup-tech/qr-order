# ADR-001 — Implementation Warnings

> **Mandatory reading before any ADR-001 PR.**  
> Canonical architecture: [ADR-001-universal-ordering-platform.md](./ADR-001-universal-ordering-platform.md)

These are known traps. Read carefully.

---

## 1. `create-order.ts` (~723 lines) — MOST CRITICAL FILE

- **Do NOT delete and rewrite from scratch.**
- Step by step: first create PG function `create_order()` that does the same job.
- Then migrate callers one by one.
- Keep old code as fallback until new path passes all tests.
- This file has ~12 DB queries + 3 RPC calls + session logic + approval flow + promo validation — **all must remain working**.
- **Remember:** `scheduleOrderTseSign()` and `scheduleNewOrderPush()` are called in **two places**:
  - `create-order.ts`
  - `approve-order-access.ts`  
  Both must move to outbox.

---

## 2. PIN reveal cache — looks easy but be careful

- **Current:** `src/lib/sessions/pin-reveal-cache.ts` uses `new Map()` — in-memory.
- **Used in two files:**
  - `approve-order-access.ts` (`storePinReveal`)
  - `approval-status/route.ts` (`consumePinReveal`)
- **When moving to Redis:**
  - `consumePinReveal` must be **atomic** (GET + DELETE in one operation).
  - Use Redis **`GETDEL`** command.
  - TTL: 10 minutes (same as today).
- **Upstash Redis already exists** in project (`rate-limit.ts`) — reuse the same client.

---

## 3. Outbox processor — race condition risk

- **Must use** `FOR UPDATE SKIP LOCKED`.
- Without it: two QStash cron invocations can pick the same event and execute twice.
- **Required:** idempotent handlers — even with SKIP LOCKED, handler must tolerate duplicate calls.
- **Batch size:** 50 max — Vercel serverless timeout (10s hobby, 60s pro).
- **Dead letter:** after `max_attempts` do **NOT delete** the event — set `status = 'failed'` + alert only.

---

## 4. Migrations — order matters

Last migration before ADR-001 work: `00060_ai_playbook.sql`.

| File | Contents |
|------|----------|
| `00061_order_events_outbox.sql` | `order_events` + `outbox_events` |
| `00062_orders_idempotency_key.sql` | `orders.idempotency_key` |
| `00063_order_channel_deliveries.sql` | `order_channel_deliveries` |
| `00064_*` (future) | `pos_integrations` + `pos_order_mappings` |
| `00065_*` (future) | `product_pos_mappings` |

- **Never** two developers on the same migration number.
- Test on clean DB: `supabase db reset` (lokalno, Docker).
- **Remote qr-order:** hibridni baseline — v. [supabase-migration-baseline.md](./supabase-migration-baseline.md). Stare migracije su `repair applied`, ne push-uj ih ponovo.

---

## 5. `approve-order-access.ts` — second critical file

This file does 6 things sequentially:

1. Check order status  
2. Create session with PIN  
3. Update order (`session_id`, status)  
4. Trust device  
5. Store PIN in memory (!)  
6. Fire-and-forget: TSE + push + webhook + audit  

- Steps **1–4** must be in **one transaction**.
- Steps **5–6** must go to **outbox**.
- **Note:** reject flow is a separate function in the same file — migrate it to outbox too.

---

## 6. DATEV mixed-rate — concrete fix

- **File:** `src/lib/export/datev.ts`
- **Was broken:** `resolveRevenueAccount()` used "dominant rate" for mixed 19% + 7% orders.
- **Fix:** `orderToDatevRows()` returns **two rows**:
  - Row 1: sum of 19% items → konto **8400**
  - Row 2: sum of 7% items → konto **8300**
- Return type: `DatevRow[]` (not single row).
- **Status:** ✅ **Done** (Track B2) — see `src/__tests__/datev.test.ts`.

---

## 7. Stripe + Vorsystem — grey zone

When guest pays online (Stripe) and restaurant has POS → QR Order is **Vorsystem**.

But:

- Stripe settlement goes to connected account.
- POS creates fiscal receipt for the same order.

**Problem:** two payment records (Stripe + POS).

**Solution:** POS receives flag **`PAID ONLINE`** — POS must **not charge again**, only book/register.

Document clearly in admin UI for restaurant owners.

---

## 8. SSE vs polling — do NOT remove polling

- `approval-waiting.tsx` uses `setInterval` polling today.
- Move to SSE (`stream` endpoint already exists).
- **But:** keep polling as fallback every **30s**.
- SSE on Vercel has ~60s limits — **reconnect strategy required**.
- **Do not touch** `usePostgresRealtime` on dashboard — it works well.

---

## 9. Mandatory test scenarios (before every merge)

| Scenario | Expected |
|----------|----------|
| Duplicate `POST /api/orders` with same `Idempotency-Key` | Same `orderId`, not duplicate |
| Kill server between order insert and items insert | Full rollback, no partial order |
| POS push fails + printer succeeds | Order still reaches kitchen |
| fiskaly API down | Outbox retries until signed |
| Staff approve then immediate refresh | PIN delivered (Redis, not in-memory) |
| Mixed 19% + 7% order → DATEV export | Two CSV rows, not one |

---

## 10. General rules

- Never write a new file if a similar one exists — extend instead.
- Check `git blame` before refactor — there is usually a reason.
- **One PR per track step** (A1, A2, A3…) — no mega-PR touching 50 files.
- Every PR must pass **build + typecheck + lint**.

---

## PR checklist (copy into PR description)

```
[ ] Read ADR-001-implementation-warnings.md
[ ] Migration number not conflicting with main
[ ] create-order.ts not rewritten wholesale
[ ] Outbox handlers idempotent
[ ] PIN uses Redis GETDEL (when A5 done)
[ ] scheduleOrderTseSign / scheduleNewOrderPush removed from direct calls (when A7/A8 done)
[ ] Tests from §9 where applicable
[ ] pnpm build && pnpm lint pass
```

# F1 End-to-End Quality Audit Log

**Date:** 2026-05-23  
**Scope:** Guest flow, dashboard flow, API error handling, AI concierge, realtime, error boundaries  
**Rule:** Fixes and polish only — no new product features.

---

## Verification checklist

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | Pass |
| `npm run lint` | Pass (pre-existing warnings) |
| `npm run build` | Pass |
| `npm run test:run` | 60/60 pass |

---

## Step 1 — Guest flow smoke test (code audit)

### Tested paths
- `/[slug]/[token]` — menu, language, allergens, product detail, cart bar
- `/cart` — quantities, modifiers, notes, upsell
- `/checkout` — promo, takeaway, PIN gate, place order
- `/order/[orderId]` — status tracker, bill panel, Stripe payment
- Offline / paused ordering edge cases

### Broken → fixed

| Issue | Fix |
|-------|-----|
| Offline checkout toast without queueing | `enqueueOfflineOrder()` + `registerOrderSync()` in checkout form |
| Product detail state leaked between products | Reset form state on `product.id` change |
| Quick-add skipped required serve size | Open detail sheet when `productHasServeSize()` |
| Paused/offline blocked menu browsing | Card stays clickable; only add button disabled |
| `/checkout` ignored `accepting_orders` | Server prop + banner + disabled submit |
| Table context fetch failure showed checkout | Error UI with retry |
| Bill panel infinite skeleton on API error | Error message + retry button |
| Stripe `processing` shown as error | Treat as in-progress; trigger poll |
| Order 401 shown as "not found" | Session-expired UI + link to menu |
| Soft-deleted products on menu | Filter `deleted_at` in menu page |
| Cart page missing Supabase guard | try/catch → `notFound()` |

---

## Step 2 — Dashboard flow smoke test (code audit)

### Tested paths
- Login → dashboard redirect, onboarding guard
- Overview metrics, orders kanban, kitchen/KDS, tables QR
- Menu editor CRUD, settings save, admin sections
- TSE settings, Tagesabschluss Z-Bon, analytics charts

### Broken → fixed

| Issue | Fix |
|-------|-----|
| Auth redirect loop (user without staff) | Middleware checks staff before login redirect; `no_access` error |
| Admin overview hardcoded €0 | Redirect to `/admin/analytics` |
| Analytics avg ticket used all orders | Denominator = paid orders only |
| Admin tables queried with null location | Location guard |
| Menu category drag always success toast | Check Supabase errors; revert on failure |
| Top bar revenue flashed €0.00 | Use layout SSR revenue until client stats load |

---

## Step 3 — Error boundary audit

### API routes (62)
- **All 62 routes** use `withErrorHandler()` → structured `{ data, error }` via `apiSuccess` / `apiError`
- Unhandled exceptions return `500` with generic message — no stack traces in response body
- Production error boundaries hide raw `error.message` (dashboard + admin)

### Pages — error boundaries

| Route group | `error.tsx` |
|-------------|-------------|
| Root | `src/app/error.tsx` |
| Guest `[token]` | `src/app/(guest)/[slug]/[token]/error.tsx` |
| Dashboard | `src/app/(dashboard)/dashboard/error.tsx` |
| Admin | `src/app/(admin)/admin/error.tsx` |
| Platform | `src/app/(platform)/error.tsx` *(added)* |
| Auth | `src/app/(auth)/error.tsx` *(added)* |

### Pages — loading skeletons

Present: guest menu, dashboard root, orders, kitchen, history, new-order, admin root.  
Client components (order board, KDS, menu editor, tables board) implement inline skeletons.

### Empty states
- Cart empty, order board empty, KDS empty, tables empty, menu categories empty — all have dedicated UI.

---

## Step 4 — AI Concierge check (code audit)

| Requirement | Status |
|-------------|--------|
| Opens and responds | `AiConciergeChat` + `/api/ai/chat` with session persistence |
| Knows menu ("what's popular?") | Catalog search + browse enrichment in `chat-service.ts` |
| Allergens ("I'm gluten free") | Sheet preferences + system prompt + moderation |
| Cart pairing banner timing | `AiCartPairingBanner` in menu-view when cart has items |
| Smart nudge | `useSmartNudges` + `AiSmartNudgeBanner` |
| OpenAI slow/down | 45s client timeout; circuit breaker; 502/503 → friendly unavailable message |

Server: `AiCircuitOpenError` → 503, `AiOpenAiError` → 502/429 with structured error (no stack leak).

---

## Step 5 — Realtime audit (code audit)

| Hook | Mechanism | Status |
|------|-----------|--------|
| Order board | `usePostgresRealtime` + 3s poll fallback | OK |
| `useRealtimeOrders` | Was empty stub → now wraps `usePostgresRealtime` | Fixed |
| `useKdsOrders` | Realtime + poll + error state | OK |
| `useRealtimeWaiterCalls` | Realtime + error state on fetch | Improved |
| `useLiveOrdersFeed` | Realtime + error state on fetch | Improved |
| Guest order tracker | 3s poll (`REALTIME_FALLBACK_POLL_MS`) | By design (no Realtime on guest) |

**Two-tab live test:** Requires manual browser QA with Supabase Realtime enabled. Architecture supports immediate updates via postgres_changes; polling fallback ensures ≤3s latency if Realtime disconnects.

---

## Step 6 — Still needs attention

| Item | Priority | Notes |
|------|----------|-------|
| Allergen filter flash before localStorage hydrate | Low | Brief wrong filter set on first paint |
| Hardcoded i18n strings (Beleg link, language splash) | Low | Full i18n pass deferred |
| Tables/menu board silent fetch failure | Medium | Empty grid without retry banner |
| Sidebar always shows "Open" | Low | Should reflect `accepting_orders` |
| Manual 375px browser QA | Medium | Code audit only; no automated E2E |
| Manual guest+dashboard two-tab order test | Medium | Verify Realtime in staging |
| `useRealtimeOrders` not yet wired into order-board | Low | Order board duplicates subscription inline |

---

## Files changed (F1)

**Guest:** `checkout-form.tsx`, `checkout/page.tsx`, `cart/page.tsx`, `page.tsx`, `product-card.tsx`, `product-detail-sheet.tsx`, `order-bill-panel.tsx`, `order-status-tracker.tsx`, `ai-concierge-chat.tsx`

**Dashboard:** `dashboard-top-bar.tsx`, `menu-editor.tsx`, `dashboard/error.tsx`

**Admin:** `admin/page.tsx`, `admin/tables/page.tsx`, `admin/error.tsx`

**Auth/platform:** `middleware.ts`, `session.ts`, `(platform)/error.tsx`, `(auth)/error.tsx`

**Analytics:** `admin-analytics.ts`

**Hooks:** `use-realtime-orders.ts`, `use-realtime-waiter-calls.ts`, `use-live-orders-feed.ts`

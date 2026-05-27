# ADR-013: Competitive Guest Journey Spine

| Field | Value |
|-------|-------|
| **Status** | **Proposed** — product MVP; **enterprise ceiling:** [ADR-014](./ADR-014-commerce-experience-platform.md) |
| **Date** | 2026-05-27 |
| **Depends on** | [ADR-005](./ADR-005-denis-maximum.md) · [ADR-009](./ADR-009-atomic-turn-commercial-spine.md) · [ADR-012](./ADR-012-fiscal-journal-spine.md) · outbox spine |
| **Pattern** | Same as ADR-009/012 — **one orchestrator**, append-only events, async side effects |

---

## 0. One sentence

**Monetize the guest journey without touching the order pipeline** — extend what already exists (`order_feedback`, reorder API, upsell, venue ops, tips) behind `runGuestExperiencePipeline()`, wired to Denis guest memory and staff copilot.

---

## 1. As-built inventory (honest)

| Feature | Already in codebase | Gap vs competitors |
|---------|---------------------|-------------------|
| Post-payment / reviews | `order_feedback`, `AiFeedbackPrompt`, `google_review_url`, Denis `REVIEW_PROMPT` scheduler | Triggers on **delivered + 10 min**, 1–5 stars only; no emoji branch; no copilot alert; no guest memory writeback; **not post-payment** for session bill |
| Quick reorder | `POST /api/orders/[orderId]/reorder`, cart hydration + 86 skip | No floating **“Noch eine Runde?”**; no session-level last-round filter; Denis upsell variant unused |
| Tips | `TipSelector` fixed €1/2/5 or 5/10/15% | No smart defaults; no guest history anchor |
| Menu personalization | `upsell_rules`, `UpsellBar`, VKG, guest memory allergies/favorites | No **Für dich** / **Beliebt gerade** menu sections; no dietary auto-filter on menu API |
| Throttling | `VenueOpsBeliefs`, `computeKdsBacklogMinutes`, auto-rush M14 | Guest never sees wait time; no pause-QR-ordering; Denis shortens replies only |
| Pre-order | — | Nothing |

**Principle:** Extend tables and routes — do **not** fork order creation or Denis runtime.

---

## 2. Architecture — Guest Journey Spine

```
┌─────────────────────────────────────────────────────────────┐
│ GUEST SURFACES (mobile-first)                               │
│ menu-view · cart · checkout · order-tracker · Denis chat    │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│ runGuestExperiencePipeline(trigger)  ← single entry           │
│   resolveExperienceMoment() · loadGuestContext()              │
│   → experience_events (append) · outbox experience.*          │
└───────────────────────────┬─────────────────────────────────┘
                            │
     ┌──────────────────────┼──────────────────────┐
     ▼                      ▼                      ▼
 guest_memory          staff_copilot           menu_projection
 (consent-scoped)      (negative alerts)      (Für dich / trending)
     │                      │                      │
     └──────────────────────┴──────────────────────┘
                            │
              order-saga · session bill · KDS floor tick
              (triggers only — never blocks payment)
```

### 2.1 Triggers (never block payment/fiscal)

| Trigger | Source | Async outbox |
|---------|--------|--------------|
| `payment_settled` | `order-saga.ts` after `payment_status=paid` | `experience.checkout_thanks` |
| `session_bill_settled` | `session-bill/route.ts` settle | `experience.feedback_prompt` |
| `order_delivered` | order status webhook / Realtime | `experience.feedback_prompt` (if not session bill) |
| `session_active` | menu page mount | `experience.menu_projection_cache` (optional) |
| `cart_open` | cart with items | reorder chip data (sync read) |
| `floor_tick` | cron M14 | `experience.capacity_broadcast` (guest wait banner) |

**Critical:** All handlers are **deferrable** (same pattern as `fiscal.tse_sign`). Payment saga completes before experience outbox runs.

### 2.2 Experience moment resolver

Dine-in payment timing varies — do **not** prompt “Wie war's?” at checkout if food is not served.

```typescript
// src/lib/guest-journey/resolve-experience-moment.ts

export type ExperienceMoment =
  | "checkout_thanks"      // paid — Denis says danke, no survey yet
  | "feedback_eligible"    // paid + meal complete (delivered or session bill)
  | "none";

export function resolveExperienceMoment(input: {
  paymentStatus: string;
  orderStatus: string;
  sessionBillSettled: boolean;
  allSessionOrdersDelivered: boolean;
}): ExperienceMoment {
  if (input.paymentStatus !== "paid") return "none";

  if (!input.sessionBillSettled && input.orderStatus !== "delivered") {
    return "checkout_thanks"; // paid early — thank only
  }

  return "feedback_eligible";
}
```

Session bill flow: feedback **once per session** when `session.bill_status = paid` and all orders delivered — not per order.

---

## 3. Shared data model

### 3.1 Extend `order_feedback` → `guest_experience_feedback`

Migration `00098_guest_experience.sql` — **extend, not replace**:

```sql
ALTER TABLE order_feedback
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES table_sessions(id),
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS sentiment TEXT CHECK (sentiment IN ('positive','neutral','negative')),
  ADD COLUMN IF NOT EXISTS category TEXT CHECK (category IN ('food','service','wait_time','other')),
  ADD COLUMN IF NOT EXISTS guest_token TEXT,
  ADD COLUMN IF NOT EXISTS google_review_clicked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS staff_response TEXT,
  ADD COLUMN IF NOT EXISTS responded_by UUID,
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trigger_moment TEXT NOT NULL DEFAULT 'delivered'
    CHECK (trigger_moment IN ('session_bill','order_delivered','payment'));

-- Session-level feedback (one row per session when bill paid)
CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_session
  ON order_feedback (session_id) WHERE session_id IS NOT NULL;

-- Keep order_id unique for per-order path
```

Map legacy 1–5 `rating` → `sentiment`: 4–5 positive, 3 neutral, 1–2 negative (backfill + dual UI during transition).

### 3.2 `location_experience_settings` (per location)

```sql
CREATE TABLE location_experience_settings (
  location_id UUID PRIMARY KEY REFERENCES locations(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id),
  feedback_enabled BOOLEAN NOT NULL DEFAULT true,
  feedback_delay_seconds INT NOT NULL DEFAULT 10,
  google_place_id TEXT,                    -- builds review deep link if google_review_url empty
  google_review_url TEXT,                  -- migrate from locations.google_review_url
  negative_alert_channel TEXT NOT NULL DEFAULT 'copilot'
    CHECK (negative_alert_channel IN ('copilot','email','both')),
  reorder_enabled BOOLEAN NOT NULL DEFAULT true,
  reorder_category_ids UUID[] DEFAULT '{}', -- empty = drinks + snacks heuristic
  tip_mode TEXT NOT NULL DEFAULT 'smart' CHECK (tip_mode IN ('fixed','smart')),
  tip_fixed_percentages INT[] DEFAULT '{10,15,20}',
  tip_custom_enabled BOOLEAN NOT NULL DEFAULT true,
  menu_personalization_enabled BOOLEAN NOT NULL DEFAULT true,
  menu_trending_hours INT NOT NULL DEFAULT 2,
  kitchen_capacity_enabled BOOLEAN NOT NULL DEFAULT true,
  scheduled_orders_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.3 `experience_events` (append-only audit / analytics)

```sql
CREATE TABLE experience_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  location_id UUID NOT NULL,
  session_id UUID,
  order_id UUID,
  event_type TEXT NOT NULL,  -- feedback_submitted, google_review_clicked, reorder_tapped, ...
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

GoBD-friendly trail for marketing analytics without mutating orders.

### 3.4 Guest memory extensions (consent-scoped)

Extend `GuestMemoryScope`: add `"tips" | "feedback" | "reorder"` — **opt-in**, default off for new scopes.

```typescript
// guest-memory sync payload additions
type GuestMemorySyncPayload = {
  // existing...
  avgTipPercent?: number;
  lastFeedbackSentiment?: 'positive' | 'neutral' | 'negative';
  usualRoundProductIds?: string[];  // max 6, drinks priority
  personalizationConsent?: boolean;   // GDPR: Für dich section
};
```

---

## 4. Feature designs

### F1 — Post-payment / feedback flow (P0, S–M)

**Upgrade path:** Replace `AiFeedbackPrompt` 1–5 stars with 3-tap sentiment + branch UI; keep API route.

| Layer | File / action |
|-------|----------------|
| UI | `src/components/guest/experience-feedback-card.tsx` (new) — replaces `ai-feedback-prompt.tsx` |
| API | Extend `src/app/api/feedback/route.ts` — accept `sentiment`, `category`; session-level POST |
| Hook | Show on `order-status-tracker` when `resolveExperienceMoment === feedback_eligible` |
| Session bill | After settle in `session-bill/route.ts` → redirect/query `?experience=1` |
| Outbox | `experience.negative_feedback` → staff copilot hint |
| Memory | `syncGuestMemory({ lastFeedbackSentiment, ... })` if consented |
| Denis | `buildScheduleDrafts` — change `REVIEW_PROMPT` to use `feedback_eligible` not raw delivered+45min |
| Admin | Extend `feedback-panel.tsx` — sentiment filter, staff response, Google CTR |

**Denis AI copy (runtime facts):**

```typescript
// In narrate facts when feedback_eligible
facts: {
  guestFirstName, lastOrderItemNames,
  previousNegativeCategory: memory.lastFeedbackSentiment === 'negative' ? memory.lastIssue : null
}
```

**Edge cases:**
- Anonymous guest → generic copy, no “we know you're vegan”
- Already submitted → idempotent 409
- Pay-before-eat → `checkout_thanks` only until delivered

**Revenue:** sunday cites ~5× Google reviews → model +15–25% review volume at pilot venues.

---

### F2 — Quick reorder / “Noch eine Runde?” (P0, S)

**Upgrade path:** Wrap existing reorder API — **no new order pipeline**.

| Layer | File / action |
|-------|----------------|
| Logic | `src/lib/guest-journey/get-last-round.ts` — filter session's latest order items by `reorder_category_ids` or `menu_section=drinks` |
| API | `GET /api/sessions/[token]/last-round?sessionToken=` → wraps reorder logic |
| UI | `src/components/guest/another-round-fab.tsx` — floating button on `menu-view` + `order-status-tracker` when session active |
| Flow | Tap → sheet with items → confirm → `useCart().addItems()` → existing checkout |
| 86 list | Reuse reorder route `is_available` + `VenueOpsBeliefs.unavailableProductIds` |
| Denis | Concierge chip “Noch eine Runde?” → same API; upsell variant via VKG `pairs_with` |

```typescript
// get-last-round.ts
export async function getLastRound(sessionId, settings): Promise<ReorderableItem[]> {
  const latestOrder = await latestOrderInSession(sessionId);
  return latestOrder.items.filter(item =>
    isRoundEligible(item, settings.reorder_category_ids)
  );
}
```

**Edge cases:** All items 86'd → show “Einige Artikel nicht verfügbar” + Denis suggests alternative from VKG.

**Revenue:** me&u +30% bar → target +15–20% drink attach on sessions with FAB enabled.

---

### F3 — Smart tip defaults (P1, S)

| Layer | File / action |
|-------|----------------|
| Logic | `src/lib/guest-journey/smart-tip-defaults.ts` |
| UI | `TipSelector` accepts `presets: TipPreset[]` prop instead of hardcoded constants |
| Config | `location_experience_settings.tip_mode` |
| Memory | If scope `tips` consented → middle preset = `round(guest.avgTipPercent)` |
| Legal | Keep **Trinkgeld freiwillig** copy in `tip.hint`; default 0 selected; no pre-checked tip |

```typescript
export function calculateSmartTipDefaults(ctx: SmartTipContext): [number, number, number] {
  if (ctx.guestHistory?.avgTipPercent && ctx.consentTips) {
    const mid = clampPercent(ctx.guestHistory.avgTipPercent);
    return [mid - 3, mid, mid + 3].map(clamp) as [number, number, number];
  }
  // tier + time rules...
}
```

**Integration:** `order-bill-panel.tsx` + checkout — pass context from location settings + guest memory hook.

**Revenue:** +8–12% tip total (competitor benchmark +10%).

---

### F4 — AI menu personalization (P1, L)

**Architecture:** Menu **projection layer** — do not mutate VKG or product tables at request time.

```
GET /api/guest/menu-projection?sessionToken=&tableToken=
  → base menu (existing query)
  → MenuProjectionEngine.enrich(base, context)
  → { sections: [...], meta: { personalized: boolean, consentRequired: boolean } }
```

| Section | Source | GDPR |
|---------|--------|------|
| **Für dich** | guest_memory favorites + order history (consent `personalization`) | Hidden if no consent — show generic “Entdecken” |
| **Beliebt gerade** | SQL aggregate `order_items` last N hours at location | Always safe (anonymous) |
| **Dietary filter** | guest_memory allergySheetIds | Auto-filter only with consent; badge “Präferenzen berücksichtigt” |
| **Smart sort** | VKG edges + margin weight from admin | No PII |
| **Upsells** | existing `upsell_rules` + `denis learned_edges` | Already in cart |

New files:

```
src/lib/guest-journey/menu-projection/
  build-trending.ts          -- SQL/RPC get_trending_products(location, hours)
  build-for-you.ts           -- memory + history
  apply-dietary-filter.ts
  rank-category-items.ts
  types.ts
```

**Optional RPC:** `get_trending_products(location_id, since)` — materialized every 15 min via cron to avoid hot path scan.

**Denis integration:** Load same projection into `runDenisTurn` context facts — concierge and menu stay consistent.

**Edge cases:** New guest → trending + default menu only; stock/86 applied last.

**Revenue:** me&u personalization → +5–15% AOV on return guests (harder to measure — track AOV cohort).

---

### F5 — Dynamic order throttling (P1, M)

**Reuse:** `computeKdsBacklogMinutes`, `VenueOpsBeliefs`, `resolveEffectiveVenueOps` — **extend, don't duplicate**.

```typescript
// src/lib/guest-journey/kitchen-capacity.ts

export type ThrottleLevel = 'normal' | 'busy' | 'overloaded';

export function getKitchenCapacity(input: {
  activeKitchenOrders: number;
  kdsBacklogMinutes: number | null;
  settings: KitchenCapacitySettings;
  ops: VenueOpsBeliefs;
}): { level: ThrottleLevel; estimatedWaitMinutes: number; acceptingOrders: boolean }
```

| Level | Guest UI | Staff |
|-------|----------|-------|
| normal | no banner | — |
| busy | “~{n} Min Wartezeit” header | Copilot heads-up |
| overloaded | wait banner + Denis suggests quick items | `acceptingOrders=false` blocks **new** cart submit only |

**Critical:** Throttling **never rejects paid orders**. Only blocks new `POST /api/orders` when `acceptingOrders=false`.

| Layer | File |
|-------|------|
| Read | `src/lib/denis/venue/floor/compute-kds-backlog.ts` |
| Merge | `load-effective-venue-ops.ts` |
| Guest banner | `menu-view.tsx` — `KitchenWaitBanner` |
| Denis | `OpsPlannerEffects` add `suggestQuickItems: boolean` |
| Staff | `denis-staff-copilot-board.tsx` — pause QR toggle → `staff-ops-actions.ts` |

Config stored in `location_experience_settings` + existing `concierge_config.ops`.

---

### F6 — Pre-order / scheduled pickup (P2, M)

**New order mode** — minimal extension to create pipeline:

```sql
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_mode TEXT NOT NULL DEFAULT 'immediate'
    CHECK (order_mode IN ('immediate', 'scheduled')),
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pickup_code TEXT;

CREATE TABLE scheduled_order_slots (
  location_id UUID NOT NULL REFERENCES locations(id),
  slot_start TIMESTAMPTZ NOT NULL,
  capacity INT NOT NULL,
  booked INT NOT NULL DEFAULT 0,
  PRIMARY KEY (location_id, slot_start)
);
```

| Layer | Action |
|-------|--------|
| Guest | New route `(guest)/[slug]/preorder` or flag on menu “Vorbestellen” |
| Create | `createOrderFromCart` accepts `scheduledFor` — **TSE/fiscal at pickup payment**, not at schedule time |
| Kitchen | KDS sort key: scheduled orders pinned until `scheduled_for - prep` |
| Outbox | `fulfillment.release_scheduled_order` cron |
| Denis | Proactive intent `PREORDER_REMINDER` from guest_memory patterns |

**Edge case:** Menu item unavailable at release → staff copilot alert + guest SMS/email (future).

**Revenue:** new channel — depends on marketing; luca/square use case is lunch crowd.

---

## 5. Outbox domain: `experience`

Extend `outbox_events.domain` check:

```sql
CHECK (domain IN ('fulfillment', 'fiscal', 'integration', 'session', 'billing', 'experience'))
```

| event_type | Handler |
|------------|---------|
| `experience.negative_feedback` | Push staff copilot hint + optional email |
| `experience.sync_guest_memory` | Write memory projection |
| `experience.record_event` | Insert `experience_events` |
| `experience.google_review_click` | Analytics |

Handlers in `src/lib/outbox/handlers/experience/`.

---

## 6. Code layout

```
src/lib/guest-journey/
  run-guest-experience-pipeline.ts
  resolve-experience-moment.ts
  get-last-round.ts
  smart-tip-defaults.ts
  kitchen-capacity.ts
  menu-projection/
  feedback/
  types.ts

src/components/guest/
  experience-feedback-card.tsx
  another-round-fab.tsx
  kitchen-wait-banner.tsx

src/lib/outbox/handlers/experience/
  negative-feedback.ts
  sync-guest-memory.ts
```

---

## 7. Build order (recommended)

| Track | Feature | Complexity | Depends on |
|-------|---------|------------|------------|
| **GJ-1** | Experience settings migration + moment resolver | S | — |
| **GJ-2** | Post-payment feedback UI + copilot alert (F1) | S–M | GJ-1 |
| **GJ-3** | Another Round FAB + get-last-round (F2) | S | GJ-1 |
| **GJ-4** | Smart tips (F3) | S | GJ-1, guest memory scope |
| **GJ-5** | Kitchen capacity guest banner + pause (F5) | M | venue ops |
| **GJ-6** | Menu projection API (F4) | L | GJ-1, guest memory |
| **GJ-7** | Scheduled orders (F6) | M | create pipeline |

**Ship order:** GJ-1 → GJ-2 → GJ-3 → GJ-4 → GJ-5 → GJ-6 → GJ-7

Each track = one PR, `pnpm test:run`, no order pipeline refactor.

---

## 8. Verification checklist (Phase 3)

| Check | How |
|-------|-----|
| Feedback async | Assert saga completes before outbox handler runs; payment webhook never awaits feedback |
| Reorder + 86 | Test `get-last-round` skips unavailable; reorder API unchanged contract |
| Tips voluntary | UI default tip=0; German hint text; no forced selection before pay |
| GDPR personalization | Für dich hidden without `personalizationConsent`; anonymous → trending only |
| Throttle never rejects paid | Integration test: paid order succeeds when `acceptingOrders=false` |
| Pre-order menu drift | Release job re-validates prices/availability; staff alert on mismatch |
| Anonymous degradation | All features return sensible defaults without guest_memory |

---

## 9. What we do NOT do

- Replace Denis runtime or `createOrderFromCart` for F1–F5
- Store personalization in product rows (projection layer only)
- Block payment/fiscal for experience features
- Show PII-based copy without consent
- Duplicate upsell engine (use `upsell_rules` + VKG + learned edges)

---

## 10. Relation to existing docs

| Doc | Role |
|-----|------|
| ADR-005 | Guest memory scopes, venue ops, proactive scheduler |
| ADR-009 | Outbox + atomic side effects pattern |
| ADR-012 | Fiscal moment separate from experience moment — both async |

---

## 11. Upgrade path (enterprise)

ADR-013 is the **fast product spine** (`runGuestExperiencePipeline`). For franchise/chain GA, use [ADR-014](./ADR-014-commerce-experience-platform.md) — same move as ADR-011 → ADR-012 for fiscal:

| ADR-013 (MVP) | ADR-014 (enterprise) |
|---------------|----------------------|
| `runGuestExperiencePipeline` | `runCommerceExperience` + RPC |
| Ad-hoc tables | `commerce_experience_events` + invariants C1–C12 |
| Memory scope flags | `guest_consent_ledger` |
| Inline menu logic | `menu_commerce_projection` |

**Pilot:** Use ADR-013 **UX specs** (moments, copy, flows) but wire through CE-1…CE-2 if targeting chain — do not ship a monolith you will delete.

---

## 12. Summary

Competitors win on **timing and UX at monetization moments**. Denis already has the AI engine, guest memory, copilot, upsell, reorder API, and KDS backlog — they're **disconnected**.

**Guest Journey Spine** connects them through:
1. `resolveExperienceMoment()` — when to ask, not just payment timestamp
2. `runGuestExperiencePipeline()` — single async entry
3. Menu projection — personalization without PII leakage
4. Extend `order_feedback` + `location_experience_settings` — no parallel feedback system

This is the bodywork on the Denis engine — same architectural move as ADR-012 for fiscal.

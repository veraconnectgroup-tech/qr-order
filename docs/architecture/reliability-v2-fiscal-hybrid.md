# QR Order — Universal Ordering System (Reliability v2)

> **Canonical architecture:** [ADR-001-universal-ordering-platform.md](./ADR-001-universal-ordering-platform.md)  
> **Implementation traps:** [ADR-001-implementation-warnings.md](./ADR-001-implementation-warnings.md) — **read before every PR**

> Master plan for Cursor / engineering.  
> **Concept:** Every order reaches the kitchen — regardless of restaurant setup.  
> **Reliability:** Atomic transactions + transactional outbox.  
> **Fiscal:** Automatic — system decides based on configuration, not admin tax knowledge.

---

## Product vision

```
Guest scans QR → orders → QR Order platform dispatches to ALL active channels:

┌───────────────────────────────────────────┐
│           QR ORDER PLATFORM               │
│   (ordering + payments + AI concierge)    │
└──────────────┬──────────────┬─────────────┘
               │              │             │
        ┌──────┴──────┐ ┌─────┴─────┐ ┌────┴────────┐
        │ KANAL 1     │ │ KANAL 2   │ │ KANAL 3     │
        │ POS Push    │ │ Cloud     │ │ Dashboard   │
        │ Deliverect  │ │ Printer   │ │ + KDS       │
        │ + direct    │ │ CloudPRNT │ │ (exists)    │
        └─────────────┘ └───────────┘ └─────────────┘
```

**Multi-channel = redundancy.** If POS is down, printer still fires. If printer offline, dashboard + KDS still show the order. **Never a lost order.**

---

## What makes this innovative

| # | Differentiator | Why it matters |
|---|----------------|----------------|
| 1 | **AI Concierge → POS** | Guest talks to AI, AI builds order, flows directly into POS. No other QR ordering product does this. |
| 2 | **Multi-channel delivery** | One order → POS + cloud printer + dashboard simultaneously. Redundancy by design. |
| 3 | **Automatic fiscal mode** | Admin never picks "KassenSichV mode". System infers from config. |
| 4 | **POS-agnostic** | Deliverect = instant 1000+ POS coverage. Direct adapters = premium native experience. |

---

## Reliability v2 core

```
POST /api/orders (Idempotency-Key)
  → create_order() RPC — single PostgreSQL transaction:
      INSERT orders + order_items + order_item_modifiers
      INSERT order_events (audit log)
      INSERT outbox_events (conditional — see matrix below)
  → COMMIT or ROLLBACK (nothing partial)

Outbox worker (QStash cron, every 5s):
  FOR UPDATE SKIP LOCKED → dispatch handler → retry with backoff
  → dead letter after N attempts → admin alert
```

**No more fire-and-forget.** Every side effect is durable.

---

## Outbox event matrix

Events are inserted **inside the same transaction** as the order. The RPC decides which rows to insert based on location config.

| event_type | When enqueued | Handler |
|------------|---------------|---------|
| `order.notify_staff` | **Always** | Push notification + Supabase Realtime (dashboard/KDS) |
| `order.push_to_pos` | POS integration `status = connected` | Deliverect or direct adapter |
| `order.cloud_print` | CloudPRNT printer configured + `auto_print = true` | Star CloudPRNT / Epson ePOS API |
| `order.tse_sign` | **Standalone fiscal** (no active POS) | QStash → fiskaly TSE |
| `order.send_receipt` | Standalone + guest email | Email with fiscal Beleg |
| `order.webhook` | Org has active webhook configs | Org webhook dispatch |

```typescript
function buildOutboxEvents(order: Order, location: LocationConfig): OutboxInsert[] {
  const events: OutboxInsert[] = [
    { event_type: "order.notify_staff", payload: { orderId: order.id } },
  ];

  if (location.posIntegration?.status === "connected") {
    events.push({
      event_type: "order.push_to_pos",
      payload: { orderId: order.id, paymentState: resolvePosPaymentState(order) },
    });
  }

  if (location.cloudPrinters.some((p) => p.auto_print)) {
    events.push({ event_type: "order.cloud_print", payload: { orderId: order.id } });
  }

  if (resolveFiscalBehavior(location) === "standalone") {
    events.push({ event_type: "order.tse_sign", payload: { orderId: order.id } });
    if (order.guest_email) {
      events.push({ event_type: "order.send_receipt", payload: { orderId: order.id } });
    }
  }

  for (const webhook of location.activeWebhooks) {
    events.push({
      event_type: "order.webhook",
      payload: { orderId: order.id, webhookId: webhook.id },
    });
  }

  return events;
}
```

**Note:** `order.notify_staff` covers Kanal 3 (dashboard/KDS). Realtime subscription on `orders` + `order_events` is the delivery mechanism — already works, now guaranteed via outbox retry if push fails.

---

## Kanal 1 — POS integration (digital)

Two tiers — middleware + direct premium:

### Nivo A: Deliverect middleware (plug-and-play)

- QR Order → Deliverect API → 1000+ POS systems
- One integration = broad coverage
- Menu sync, order injection, status callbacks
- ~79€/month per location (Deliverect pricing — pass-through or bundled)
- **First POS ship target** for maximum coverage

### Nivo B: Direct premium integrations

- QR Order → Lightspeed / orderbird / ready2order API directly
- Deeper: menu sync, table sync, real-time status, split payments
- No middleware fee — premium feature for large chains
- Add incrementally after Deliverect baseline

| Provider | Tier | Phase |
|----------|------|-------|
| **Deliverect** | A — middleware | Phase 2 (first) |
| Lightspeed | B — direct | Phase 3 |
| orderbird | B — direct | Phase 3 |
| ready2order | B — direct | Phase 4 |
| SumUp POS | B — limited API | Phase 4 |
| custom/webhook | B — generic POST | Phase 3 |

**Adapter pattern** (`src/lib/pos/`):

```typescript
interface PosAdapter {
  provider: PosProvider;
  testConnection(creds): Promise<TestResult>;
  pushOrder(payload: PosOrderPayload, creds): Promise<PosPushResult>;
  // future: syncMenu, syncTables, onStatusCallback
}
```

Deliverect and Lightspeed both implement `PosAdapter`. Outbox handler calls `getAdapter(integration.provider)`.

---

## Kanal 2 — Cloud printer

- **Star Micronics CloudPRNT** / **Epson ePOS Print**
- QR Order sends print job via cloud API → kitchen ticket prints automatically
- No tablet needed, no POS needed
- Ideal: small restaurants, fast food, kiosks
- Hardware: ~150–200€ one-time

**Current state:** LAN/USB ESC/POS exists (`printer_configs`, `print-kitchen-order.ts`).  
**Target:** extend `printer_configs.type` with `cloudprnt` | `epos`, store cloud device ID + API token.

Outbox handler `order.cloud_print`:
1. Load order + items
2. Filter printers by `target_sections` / `print_for`
3. Format kitchen ticket (reuse `formatKitchenTicket`)
4. POST to CloudPRNT / ePOS API
5. Record delivery in `order_channel_deliveries`

---

## Kanal 3 — Dashboard + KDS (exists)

- Web dashboard order board — **works**
- Kitchen Display (KDS) — **works**
- Push notifications — **works** (move to outbox)
- SSE/Realtime — **works** (wire guest side fully in v2)
- **0€ extra cost**

Outbox `order.notify_staff` replaces direct `scheduleNewOrderPush()` calls.

---

## Automatic fiscal mode (no manual admin toggle)

**Admin does NOT choose fiscal mode.** System derives it:

```
resolveFiscalBehavior(location):
  IF location has pos_integration with status = 'connected'
    → Vorsystem (pos_integration)
       → ZERO fiscal obligations on QR Order
       → POS handles TSE, Beleg, DSFinV-K
       → fiskaly NEVER called
       → outbox: NO tse_sign, NO send_receipt (fiscal)

  ELSE
    → Standalone kasa
       → fiskaly TSE signing
       → Beleg, DATEV, Z-Bon, DSFinV-K
       → works even with ONLY printer or ONLY dashboard configured
```

| Setup | Kitchen channels | Fiscal |
|-------|------------------|--------|
| POS only | Kanal 1 | Vorsystem |
| Printer only | Kanal 2 | Standalone (fiskaly) |
| Dashboard only | Kanal 3 | Standalone (fiskaly) |
| POS + printer + dashboard | All 3 | Vorsystem |
| Nothing configured | Kanal 3 always | Standalone |

**Admin UI shows derived status**, not a radio button:

```
┌─────────────────────────────────────────────────┐
│ Fiskal-Status                                   │
│ ● Vorsystem — POS verbunden (Lightspeed)        │
│   Keine TSE-Pflicht für QR Order                │
│                                                 │
│ — or —                                          │
│                                                 │
│ ● Standalone Kasse — QR Order ist deine Kasse   │
│   TSE aktiv ✓  │  Beleg  │  DATEV Export       │
└─────────────────────────────────────────────────┘
```

TSE settings panel visible **only** in standalone mode.

### Legal basis (DE)

KassenSichV applies to **Registrierkassen**. QR Order as Vorsystem (order forwarder only) = like waiter tablet. **No TSE required.**

---

## Payment options (per location)

Existing columns: `payment_online_enabled`, `payment_at_bar_enabled`, `payment_card_at_table_enabled`.

| Mode | Guest experience | POS receives |
|------|------------------|--------------|
| **1. Online only** | Stripe checkout in app | `payment_status: PAID` |
| **2. Pay at register** | Order placed, pay in restaurant | `payment_status: UNPAID` |
| **3. Both** | Guest chooses at checkout | `PAID` or `UNPAID` per order |

```typescript
function resolvePosPaymentState(order: Order): "PAID" | "UNPAID" {
  return order.payment_status === "paid" ? "PAID" : "UNPAID";
}
```

POS adapter maps this to provider-specific fields (Deliverect `payment.amount`, Lightspeed `paid: true`, etc.).

**Fiscal note (Mod B + Stripe):** Guest pays via QR Order Stripe, POS registers the sale. Buchhaltung may need separate reconciliation — document in admin help text. Not a QR Order fiscal duty in Vorsystem mode.

---

## AI Concierge → same pipeline

```
Guest chat → AI builds draft → submit
  → create_order() RPC (same as manual checkout)
  → same outbox events (POS + printer + dashboard + fiscal)
```

AI never writes to `orders` directly. Reuses idempotency key = `hash(ai_session_id + draft_revision)`.

**Innovation:** conversational order → lands in real POS kitchen ticket. Unique in market.

---

## Database schema

### Migration `00061_universal_ordering.sql`

```sql
-- NO manual fiscal_mode column on organizations.
-- Fiscal behavior is computed from pos_integrations.status.

-- POS / Deliverect connections per location
CREATE TABLE pos_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN (
    'deliverect', 'lightspeed', 'orderbird', 'ready2order', 'sumup', 'webhook'
  )),
  tier TEXT NOT NULL CHECK (tier IN ('middleware', 'direct')),
  credentials_encrypted TEXT NOT NULL,
  credentials_iv TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('disconnected', 'connected', 'error')),
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id)  -- one active POS connection per location
);

-- Per-channel delivery tracking (multi-channel audit)
CREATE TABLE order_channel_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('pos', 'cloud_print', 'dashboard', 'webhook')),
  provider TEXT,  -- deliverect, lightspeed, star_cloudprnt, etc.
  status TEXT NOT NULL CHECK (status IN ('pending', 'delivered', 'failed', 'skipped')),
  external_id TEXT,
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, channel, provider)
);

-- Cloud printer extension
ALTER TABLE printer_configs
  DROP CONSTRAINT IF EXISTS printer_configs_type_check;
ALTER TABLE printer_configs
  ADD CONSTRAINT printer_configs_type_check
  CHECK (type IN ('usb', 'lan', 'cloudprnt', 'epos'));
ALTER TABLE printer_configs
  ADD COLUMN IF NOT EXISTS cloud_device_id TEXT,
  ADD COLUMN IF NOT EXISTS cloud_credentials_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS cloud_credentials_iv TEXT;

-- Order tracking
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS pos_external_id TEXT,
  ADD COLUMN IF NOT EXISTS pos_provider TEXT;

CREATE UNIQUE INDEX idx_orders_idempotency
  ON orders (idempotency_key) WHERE idempotency_key IS NOT NULL;
```

### Migration `00062_reliability_outbox.sql`

```sql
CREATE TABLE order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  idempotency_key TEXT,
  actor_type TEXT,
  actor_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, idempotency_key) WHERE idempotency_key IS NOT NULL
);

CREATE TABLE outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type TEXT NOT NULL DEFAULT 'order',
  aggregate_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 10,
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_outbox_pending ON outbox_events (next_retry_at)
  WHERE status IN ('pending', 'failed') AND attempts < max_attempts;
```

---

## Feature flags

```typescript
// src/lib/platform/feature-flags.ts
export const PLATFORM_FEATURES = [
  "ai_concierge",
  "split_payments",
  "fiscal",           // standalone TSE — auto-disabled when POS connected
  "pos_integration",  // gates POS admin UI + push_to_pos handler
  "cloud_print",      // gates CloudPRNT admin + cloud_print handler
  "multi_location",
  "api_access",
] as const;
```

---

## Admin UI — what the restaurant sees

**Location:** `Settings` in admin (`src/app/(admin)/admin/settings/page.tsx`)

Three sections. Restaurant staff never configures fiscal law — system derives compliance from channel setup.

---

### Settings → Order Delivery Channels

**Component:** `src/components/admin/order-delivery-channels-panel.tsx`

```
Order Delivery Channels
─────────────────────────────────
✅ Dashboard & KDS          [always on — cannot disable]
   Web dashboard, kitchen display, push notifications.
   Included — no extra cost.

⬜ Cloud Printer            [Configure →]
   Star CloudPRNT / Epson ePOS — auto-print in kitchen.
   Links to printer settings (extend existing panel).

⬜ POS Integration          [Connect POS →]  🔒 Coming Soon
   Send orders to your existing register system.
   │
   ├ Deliverect (1000+ POS systems)     [recommended]
   ├ Lightspeed (direct)                [premium]
   ├ orderbird (direct)                 [premium]
   └ ready2order (direct)               [premium]
```

| Row | Behavior |
|-----|----------|
| **Dashboard & KDS** | Always enabled. Read-only toggle (checked, disabled). Kanal 3 is never optional. |
| **Cloud Printer** | Links to printer settings. Enabled when ≥1 `cloudprnt` printer configured with valid credentials. |
| **POS Integration** | **Phase 1:** entire block visible but locked — badge "Coming Soon", connect button disabled. **Phase 2:** unlock when Deliverect adapter ships + `pos_integration` feature flag. Provider picker opens credential wizard. |

Status badges per channel: `Active` (green) · `Not configured` (gray) · `Error` (red, shows `last_error`).

---

### Settings → Payment Options

**Component:** extend existing location settings or `src/components/admin/payment-options-panel.tsx`

Uses existing DB columns: `payment_online_enabled`, `payment_at_bar_enabled`, `payment_card_at_table_enabled`.

```
Payment Options
─────────────────────────────────
✅ Online payment (Stripe)   [toggle]
   Guest pays in the app. POS receives order as PAID.

⬜ Pay at register           [toggle]
   Guest orders now, pays at the bar/register.
   POS receives order as UNPAID.

(Both enabled → guest chooses at checkout.)
```

| Toggle | Maps to | POS flag |
|--------|---------|----------|
| Online (Stripe) | `payment_online_enabled` | `PAID` when `payment_status = paid` |
| Pay at register | `payment_at_bar_enabled` | `UNPAID` |
| Both on | Guest checkout choice | per order |

Requires Stripe Connect onboarded for online toggle to enable.

---

### Fiscal Compliance (automatic — read only)

**Component:** `src/components/admin/fiscal-compliance-badge.tsx`

No toggles. Derived from `resolveFiscalBehavior(location)`:

```
Fiscal Compliance
─────────────────────────────────
🟢 Mode: POS Integration (Vorsystem)
   "Your register system handles fiscal compliance."
   Connected: Deliverect → Lightspeed Restaurant
   QR Order has no TSE obligation.

— or —

🟡 Mode: Standalone register (fiskaly TSE)
   "QR Order handles TSE signing for this location."
   → shows existing TseSettingsPanel below
   → Beleg, DATEV export, Z-Bon (as implemented)
```

| Derived mode | TSE panel | fiskaly |
|--------------|-----------|---------|
| Vorsystem (POS connected) | Hidden | Never called |
| Standalone (no POS) | Visible | Active via outbox |

Copy is plain language — no KassenSichV jargon for restaurant owners.

---

### Admin UI implementation notes

| File | Action |
|------|--------|
| `order-delivery-channels-panel.tsx` | **New** — channel overview |
| `fiscal-compliance-badge.tsx` | **New** — read-only derived status |
| `payment-options-panel.tsx` | **New or extend** `location-settings` |
| `tse-settings-panel.tsx` | Show only when standalone |
| `printer-settings-panel.tsx` | Add CloudPRNT type (Phase 3) |
| `admin/settings/page.tsx` | Wire panels in order: Channels → Payment → Fiscal → TSE (conditional) |

i18n keys under `admin.settings.deliveryChannels.*`, `admin.settings.fiscal.*` — DE primary.

---

## API routes (new)

| Route | Purpose |
|-------|---------|
| `GET /api/admin/integrations` | All channel statuses for location |
| `PUT /api/admin/pos-integration` | Save POS credentials |
| `POST /api/admin/pos-integration/test` | Test connection |
| `POST /api/jobs/outbox-process` | Outbox worker entry point |
| `POST /api/jobs/push-to-pos` | POS push (from outbox) |
| `POST /api/jobs/cloud-print` | CloudPRNT push (from outbox) |
| `POST /api/webhooks/deliverect` | Status callbacks from Deliverect |

---

## Standalone fiscal backlog

Only when `resolveFiscalBehavior() === 'standalone'`:

| # | Item | Target |
|---|------|--------|
| 1 | TSE retry via outbox | Guaranteed delivery |
| 2 | DATEV mixed-rate split | 8400 + 8300 rows, not dominant rate |
| 3 | Proper Beleg | Full legal receipt with TSE QR |
| 4 | Z-Bon | Daily fiscal close |
| 5 | DSFinV-K | Blocked — await fiskaly/fiskaltrust |

---

## Implementation phases

### Phase 0 — Reliability foundation (Week 1–2)
- [ ] Migrations: outbox, order_events, order_channel_deliveries
- [ ] RPC: `create_order()` with conditional outbox insert
- [ ] Outbox processor + dead letter alerts
- [ ] Idempotency on `POST /api/orders`
- [ ] Migrate `scheduleNewOrderPush` → `order.notify_staff` outbox
- [ ] Migrate TSE → `order.tse_sign` outbox
- [ ] PIN reveal → Redis/Postgres (remove in-memory)

### Phase 1 — Admin shell + auto fiscal (Week 2)
- [ ] Integrations panel with read-only fiscal status
- [ ] POS panel (Coming Soon locked)
- [ ] Conditional TSE panel visibility

### Phase 2 — Kanal 1: Deliverect (Week 3–4)
- [ ] Deliverect adapter
- [ ] `order.push_to_pos` handler
- [ ] PAID/UNPAID mapping
- [ ] Status callback webhook
- [ ] Enable `pos_integration` flag for pilot

### Phase 3 — Kanal 2: CloudPRNT (Week 4–5)
- [ ] CloudPRNT printer type in admin
- [ ] `order.cloud_print` outbox handler
- [ ] `order_channel_deliveries` tracking UI

### Phase 4 — Direct POS premium (ongoing)
- [ ] Lightspeed / orderbird direct adapters
- [ ] Menu + table sync

### Phase 5 — Standalone fiscal hardening
- [ ] DATEV split, Beleg, Z-Bon

---

## Invariants

| Rule | Enforcement |
|------|-------------|
| Kitchen always gets order | `order.notify_staff` always enqueued; Kanal 3 never skipped |
| POS connected → no fiskaly | `buildOutboxEvents` skips `tse_sign`; worker double-checks |
| Each channel independent | Separate outbox events; one channel failing doesn't block others |
| POS push idempotent | `order_channel_deliveries` unique + outbox retry safe |
| Fiscal mode never manual | Computed only — no DB column admin can misconfigure |
| AI uses same pipeline | `create_order()` RPC for all order sources |

---

## Testing checklist

### Multi-channel
- [ ] POS + printer + dashboard all active → 3 channel deliveries recorded
- [ ] POS down → printer + dashboard still deliver; POS retries → alert
- [ ] Printer only setup → standalone fiscal + cloud_print + notify_staff

### Auto fiscal
- [ ] Connect POS → TSE panel hidden, no tse_sign outbox event
- [ ] Disconnect POS → standalone mode, TSE fires

### Payment → POS
- [ ] Stripe paid order → POS receives PAID
- [ ] Pay at bar → POS receives UNPAID

### AI
- [ ] AI submit → same outbox events as guest checkout
- [ ] Duplicate submit → idempotent same order_id

---

## Open questions

1. **Deliverect vs Lightspeed first?** — Recommend Deliverect for coverage; direct for first enterprise pilot.
2. **Stripe + Vorsystem Buchhaltung** — help text / DATEV note for accountants?
3. **Table mapping** — manual admin map vs POS sync?
4. **DSFinV-K** — blocked on external provider guidance.

---

## REZIME ZA CURSOR — implementation checklist

Use this as the authoritative task list. Full detail in sections above.

### Already planned (Reliability v2 — build as specified)

- [ ] Atomic `create_order()` RPC (order + items + events in one TX)
- [ ] `outbox_events` + `order_events` tables
- [ ] Outbox worker with retry + dead letter + admin alert
- [ ] Idempotency key on `POST /api/orders`
- [ ] PIN reveal → Redis/Postgres (remove in-memory cache)
- [ ] Staff approve/reject idempotent RPC
- [ ] Migrate `scheduleNewOrderPush` → outbox `order.notify_staff`

### ADD — Universal ordering (this document)

- [ ] **Three delivery channels** — POS, Cloud Printer, Dashboard/KDS
- [ ] **`order_channel_deliveries`** — per-channel audit table
- [ ] **Outbox event types:**
  - `order.push_to_pos` — when POS connected
  - `order.cloud_print` — when CloudPRNT printer active
  - `order.notify_staff` — always
  - `order.tse_sign` — standalone only
  - `order.webhook` / `order.send_receipt` — conditional
- [ ] **`buildOutboxEvents()`** — conditional insert inside `create_order()` TX

### ADD — POS integration

- [ ] **Deliverect** as primary middleware adapter (`src/lib/pos/adapters/deliverect.ts`)
- [ ] Direct adapters later: Lightspeed, orderbird, ready2order
- [ ] `pos_integrations` table (one per location)
- [ ] PAID / UNPAID mapping to POS payload
- [ ] Deliverect status callback webhook
- [ ] **POS UI locked (Coming Soon)** until Deliverect integration complete — UI exists, not functional

### ADD — Cloud printer

- [ ] Star **CloudPRNT** support (`printer_configs.type = 'cloudprnt'`)
- [ ] Outbox handler `order.cloud_print`
- [ ] Extend existing `printer-settings-panel.tsx`

### ADD — Automatic fiscal mode

- [ ] **`resolveFiscalBehavior(location)`** — computed, never stored as admin toggle
- [ ] POS connected → Vorsystem, skip `order.tse_sign`, hide TSE panel
- [ ] No POS → standalone, fiskaly via outbox
- [ ] **`fiscal-compliance-badge.tsx`** — read-only admin display

### ADD — Admin UI (Phase 1 — shell only)

- [ ] `order-delivery-channels-panel.tsx`
- [ ] `payment-options-panel.tsx` (or extend location settings)
- [ ] `fiscal-compliance-badge.tsx`
- [ ] POS block visible + **Coming Soon** locked
- [ ] Dashboard & KDS always-on row

### Standalone fiscal fixes (inside Reliability v2, standalone mode only)

- [ ] TSE retry via outbox (replaces fire-and-forget)
- [ ] DATEV mixed-rate split (8400 + 8300, not dominant rate)
- [ ] Proper Beleg (legal receipt with TSE QR)
- [ ] Z-Bon daily close
- [ ] DSFinV-K — blocked, await fiskaly/fiskaltrust

### Build order

```
Phase 0  Reliability v2 foundation (outbox, RPC, idempotency)
Phase 1  Admin UI shell (channels + payment + fiscal badge, POS locked)
Phase 2  Deliverect adapter + unlock POS integration
Phase 3  CloudPRNT + cloud_print outbox handler
Phase 4  Direct POS adapters (Lightspeed, orderbird…)
Phase 5  Standalone fiscal hardening (DATEV, Beleg, Z-Bon)
```

### Do NOT do

- Do not add manual `fiscal_mode` radio — fiscal is always derived
- Do not call fiskaly when POS integration is connected
- Do not ship functional POS connect before Deliverect adapter is tested
- Do not disable Dashboard/KDS channel — it is always on

---

## Summary

| Layer | What |
|-------|------|
| **Reliability** | Atomic TX + outbox + idempotency + channel delivery audit |
| **Kitchen** | Always — POS + cloud print + dashboard in parallel |
| **Fiscal** | Automatic — POS connected = Vorsystem; else standalone fiskaly |
| **POS** | Deliverect (breadth) + direct adapters (depth) |
| **Payment** | PAID/UNPAID flag to POS per guest choice |
| **AI** | Same `create_order()` — concierge to kitchen to POS |
| **Admin** | Channels + Payment toggles; fiscal is read-only derived status |

**The outbox is the hinge.** One transaction creates the order; conditional events fan out to every active channel. Retry guarantees delivery. Dead letter guarantees visibility.

# ADR-001: Universal Ordering Platform — Enterprise Architecture

| Field | Value |
|-------|-------|
| **Status** | **Approved** |
| **Date** | 2026-05-23 |
| **Authors** | QR Order engineering |
| **Supersedes** | Ad-hoc fire-and-forget side effects in `create-order.ts` |
| **Related** | [reliability-v2-fiscal-hybrid.md](./reliability-v2-fiscal-hybrid.md) (implementation notes) · **[Implementation warnings](./ADR-001-implementation-warnings.md)** (required for all PRs) · **[Session prompts](./ADR-001-session-prompts.md)** (copy-paste for autonomous Cursor sessions) |

---

## 1. Context

QR Order is an **enterprise ordering infrastructure** for hospitality (DE/DACH primary). Guests scan QR → order → pay. Staff use dashboard/KDS. Owners use admin.

### Current problems

| Problem | Impact |
|---------|--------|
| Order write = multiple SQL calls without transaction | Partial orders possible |
| Side effects (TSE, push, webhooks) are fire-and-forget | Lost notifications, retry loops |
| In-memory PIN reveal cache on serverless | PIN not delivered cross-instance |
| No guest order idempotency | Duplicate orders on retry |
| Staff approve can succeed in DB but fail in API | 409 retry loops |
| Single fiscal path (always fiskaly) | Wrong model for 95% of DE venues with existing POS |
| Kitchen delivery = dashboard only if POS fails silently | Lost orders perception |

### Business constraints

- **KassenSichV (DE):** QR Order is either a full **Kasse** (standalone) or a **Vorsystem** (pre-system) when POS handles fiscal.
- **Enterprise buyers:** multi-location, existing POS (Lightspeed, orderbird, ready2order), audit trail, rollout templates.
- **Innovation targets:** AI Concierge → POS, multi-channel redundancy, zero fiscal config for restaurant owners.

---

## 2. Decision

Build a **Universal Ordering Platform** on three bounded contexts:

```
┌─────────────────────────────────────────────────────────────┐
│                     ORDER CORE                             │
│  Atomic create · state machine · idempotency · audit log    │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
┌─────────────────┐ ┌─────────────┐ ┌─────────────────┐
│  FULFILLMENT    │ │   FISCAL    │ │  INTEGRATIONS   │
│  Kitchen always │ │  Standalone │ │  POS · Webhooks │
│  Multi-channel  │ │  only       │ │  Org API        │
└─────────────────┘ └─────────────┘ └─────────────────┘
```

**Transactional outbox** connects Order Core to all side effects. **Fiscal behavior is derived**, never manually toggled by restaurant staff.

---

## 3. Product vision

**Every order reaches the kitchen — regardless of restaurant setup.**

```
                    QR ORDER PLATFORM
              (ordering · payments · AI concierge)
                           │
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
  KANAL 1              KANAL 2              KANAL 3
  POS Push             Cloud Printer        Dashboard + KDS
  Deliverect +         Star CloudPRNT       (always on)
  direct adapters      Epson ePOS
```

Multi-channel = **operational redundancy**. Fiscal = **separate concern** (see §8).

---

## 4. Architectural principles

1. **PostgreSQL is source of truth** — no critical state in serverless RAM.
2. **One write = one transaction** for order creation (header + items + events + outbox).
3. **At-least-once delivery + idempotent consumers** — outbox with retry and dead letter.
4. **Fulfillment ≠ Fiscal** — kitchen delivery can succeed while fiscal runs on different track.
5. **Derived configuration** — fiscal mode, active channels computed from location setup.
6. **Adapter pattern** — POS, printers, webhooks plug in without forking order pipeline.
7. **Single order pipeline** — guest checkout, staff orders, AI submit all call `create_order()`.
8. **Enterprise rollout** — location templates, setup wizard, per-location channel config.

---

## 5. Order Core

### 5.1 Create order flow

```
POST /api/orders
  Header: Idempotency-Key (client UUID, required in v2)
  │
  ├─ Redis/idempotency check → return cached orderId if duplicate
  │
  └─ create_order() — PostgreSQL RPC or equivalent atomic unit:
       VALIDATE prices, availability, session, device block
       INSERT orders (+ idempotency_key)
       INSERT order_items + order_item_modifiers
       INSERT order_events ('order.created' | 'order.approval_requested')
       INSERT outbox_events (conditional — see §7)
       COMMIT
```

**Approval path** (`pending_approval`) uses same core; outbox for TSE/fiscal deferred until staff approves (session exists).

### 5.2 State machine

Statuses (existing): `pending_approval` → `pending` → `accepted` → `preparing` → `ready` → `delivered` | `rejected` | `cancelled`.

**Rule:** transitions via `transition_order_status()` RPC with `SELECT … FOR UPDATE` and allowed-transition matrix. Staff PATCH must not bypass RPC.

### 5.3 Audit log — `order_events`

Append-only. Every state change and significant action.

```sql
order_events (
  id, order_id, event_type, payload jsonb,
  idempotency_key, actor_type, actor_id, created_at
)
```

Used for: debugging, compliance export, Realtime enrichment, operations analytics.

### 5.4 Idempotency

| Scope | Key | Storage |
|-------|-----|---------|
| Guest `POST /api/orders` | `Idempotency-Key` header | `orders.idempotency_key` UNIQUE + Redis TTL 24h |
| Staff approve | Request UUID | outbox / RPC dedup |
| AI submit | `hash(session_id + draft_revision)` | Redis (existing pattern, extend) |
| Stripe webhook | `event.id` | `webhook_events` (exists) |
| Outbox handler | `(aggregate_id, event_type)` | processor marks `done` |

---

## 6. Transactional outbox

### 6.1 Table

```sql
outbox_events (
  id uuid PK,
  aggregate_type text NOT NULL DEFAULT 'order',
  aggregate_id uuid NOT NULL,
  domain text NOT NULL,           -- 'fulfillment' | 'fiscal' | 'integration'
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
    -- pending | processing | done | failed
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 10,
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
)
```

Index: `(next_retry_at) WHERE status IN ('pending','failed') AND attempts < max_attempts`

### 6.2 Worker

- **Trigger:** QStash cron `POST /api/jobs/outbox-process` every 5s (or Vercel cron).
- **Claim:** `FOR UPDATE SKIP LOCKED` batch of 50.
- **Dispatch:** handler registry by `event_type`.
- **Retry:** exponential backoff `min(300s, 2^attempts * 5s)`.
- **Dead letter:** `status = failed` after max_attempts → insert `integration_alerts` + admin notification.

### 6.3 Event catalog

#### Fulfillment domain (kitchen — always relevant)

| event_type | When | Handler |
|------------|------|---------|
| `fulfill.notify_staff` | **Always** on order create/approve | Push + Supabase Realtime |
| `fulfill.push_pos` | POS integration `connected` | POS adapter (§9) |
| `fulfill.cloud_print` | CloudPRNT printer active + auto_print | Cloud print API (§10) |

#### Fiscal domain (standalone only — §8)

| event_type | When | Handler |
|------------|------|---------|
| `fiscal.tse_sign` | No active POS integration | `/api/jobs/tse-sign` → fiskaly |
| `fiscal.beleg` | TSE signed + standalone | Beleg generator (future) |
| `fiscal.send_receipt` | Guest email + standalone | Email job (informational/fiscal) |
| `fiscal.z_bon` | Daily cron, standalone locations | Z-Bon generator (future) |

#### Integration domain

| event_type | When | Handler |
|------------|------|---------|
| `integration.webhook` | Org webhook configs active | `dispatchOrgWebhook` |

### 6.4 Building outbox rows (inside create TX)

```typescript
function buildOutboxEvents(ctx: OrderCreatedContext): OutboxInsert[] {
  const events: OutboxInsert[] = [
    { domain: "fulfillment", event_type: "fulfill.notify_staff", ... },
  ];

  if (ctx.posIntegration?.status === "connected") {
    events.push({
      domain: "fulfillment",
      event_type: "fulfill.push_pos",
      payload: { orderId, paymentState: ctx.paymentState }, // PAID | UNPAID
    });
  }

  if (ctx.cloudPrinters.some(p => p.auto_print)) {
    events.push({ domain: "fulfillment", event_type: "fulfill.cloud_print", ... });
  }

  if (resolveFiscalBehavior(ctx.location) === "standalone") {
    events.push({ domain: "fiscal", event_type: "fiscal.tse_sign", ... });
    if (ctx.guestEmail) {
      events.push({ domain: "fiscal", event_type: "fiscal.send_receipt", ... });
    }
  }

  for (const wh of ctx.activeWebhooks) {
    events.push({ domain: "integration", event_type: "integration.webhook", ... });
  }

  return events;
}
```

### 6.5 Channel delivery audit

```sql
order_channel_deliveries (
  id, order_id,
  channel text,     -- 'dashboard' | 'pos' | 'cloud_print' | 'webhook'
  provider text,    -- 'internal' | 'deliverect' | 'star_cloudprnt' | ...
  status text,      -- pending | delivered | failed | skipped
  external_id text,
  attempts int,
  last_error text,
  delivered_at timestamptz,
  UNIQUE (order_id, channel, coalesce(provider, ''))
)
```

**SLO:** `fulfill.notify_staff` delivered &lt; 2s p99. Failed channel ≠ failed order if another channel succeeded.

---

## 7. Fulfillment — three channels

### Kanal 3: Dashboard + KDS (mandatory)

- **Always enabled.** Cannot be disabled in admin.
- Delivery: Supabase Realtime on `orders` + `order_events`, push notifications.
- Existing: `order-board.tsx`, `kds-board.tsx`, `usePostgresRealtime`.
- Outbox ensures push fires even if Realtime hiccups (backup poll exists).

### Kanal 2: Cloud printer

- **Star Micronics CloudPRNT**, **Epson ePOS Print**.
- Extends `printer_configs.type`: `usb | lan | cloudprnt | epos`.
- Cloud credentials encrypted (same pattern as POS).
- Works **without POS** — ideal fast food, kiosks (~150–200€ hardware).
- Reuses kitchen ticket formatter (`formatKitchenTicket`).

### Kanal 1: POS integration

See §9. Independent of Kanal 2 and 3.

**Redundancy example:** POS API down → printer + dashboard still deliver; outbox retries POS; ops health shows amber on POS channel.

---

## 8. Fiscal — automatic mode

### 8.1 Legal basis (DE)

| Mode | Condition | QR Order role | TSE on QR Order? |
|------|-----------|---------------|------------------|
| **Vorsystem** | Active POS integration (`status = connected`) | Pre-system only | **No** |
| **Standalone Kasse** | No POS integration | Full register | **Yes** (fiskaly) |

Applies even if venue uses **only printer** or **only dashboard** — no POS ⇒ standalone.

**Setup matrix (explicit):**

| Restaurant setup | Fiscal mode | Who signs TSE |
|------------------|-------------|---------------|
| **Printer only** (no POS) | Standalone Kasse | QR Order (fiskaly) |
| **Dashboard / KDS only** (no POS) | Standalone Kasse | QR Order (fiskaly) |
| **Printer + POS connected** | Vorsystem | POS — QR Order has no fiscal duty |
| **POS only** (no printer) | Vorsystem | POS |

Printer and dashboard are **fulfillment channels only** — they do not change fiscal classification. Only a **connected POS integration** switches the location to Vorsystem.

### 8.2 Resolution function

```typescript
function resolveFiscalBehavior(location: LocationContext): "standalone" | "vorsystem" {
  const pos = location.posIntegration;
  if (pos && pos.status === "connected") return "vorsystem";
  return "standalone";
}
```

**No `fiscal_mode` column editable by admin.** Optional cached/denormalized column for reporting only, always synced from integration state.

### 8.3 Standalone fiscal scope

| Capability | Status | Outbox event |
|------------|--------|--------------|
| TSE signing (fiskaly) | Exists | `fiscal.tse_sign` |
| DATEV export | Exists — fix mixed rate | export job, not outbox |
| Beleg (legal receipt) | Partial | `fiscal.beleg` |
| Z-Bon (daily close) | Not built | `fiscal.z_bon` cron |
| DSFinV-K | Blocked — await fiskaly/fiskaltrust | future |

### 8.4 Vorsystem rules

- Never call `fiskaly` APIs.
- Never write `tse_signature` on orders.
- Exclude from DATEV/DSFinV-K exports.
- Guest receipt: disclaimer „Beleg über Ihre Kasse“ — not fiscal Beleg.
- POS owns TSE, Beleg, DSFinV-K.

---

## 9. POS integration architecture

### 9.1 Two tiers

| Tier | Provider | Value | Cost |
|------|----------|-------|------|
| **A — Middleware** | **Deliverect** | 1000+ POS, plug-and-play | ~79€/loc/mo |
| **B — Direct premium** | Lightspeed, orderbird, ready2order, SumUp, webhook | Deep sync, no middleware fee | Dev + maintenance |

**Both implement `PosAdapter`.** Location has one **primary** integration; optional **fallback** (e.g. webhook) — not `UNIQUE(location_id)` hard lock without fallback slot.

### 9.2 Adapter interface

```typescript
interface PosAdapter {
  provider: PosProvider;
  tier: "middleware" | "direct";
  testConnection(creds): Promise<TestResult>;
  pushOrder(payload: PosOrderPayload, creds): Promise<PosPushResult>;
  parseStatusWebhook(body, headers): PosStatusUpdate | null;
  // phase 2+: syncMenu(), syncTables()
}

type PosOrderPayload = {
  orderId: string;
  orderNumber: number;
  tableName: string;
  items: PosLineItem[];
  paymentState: "PAID" | "UNPAID";
  notes?: string;
};
```

### 9.3 Bidirectional sync (required for production)

Push-only is insufficient. **Inbound webhooks** update QR Order:

| POS event | QR Order action |
|-----------|-----------------|
| accepted | `transition_order_status(accepted)` |
| preparing / ready / delivered | sync status |
| cancelled | reject + notify guest |
| paid (at register) | `payment_status = paid` |

```sql
pos_order_mappings (
  order_id uuid PK REFERENCES orders(id),
  provider text,
  external_id text NOT NULL,
  external_status text,
  last_synced_at timestamptz,
  UNIQUE (provider, external_id)
)
```

**Deliverect adapter + inbound webhooks ship together** — not push alone.

### 9.4 Database — `pos_integrations`

```sql
pos_integrations (
  id uuid PK,
  org_id uuid NOT NULL,
  location_id uuid NOT NULL,
  provider text NOT NULL,  -- deliverect | lightspeed | orderbird | ...
  tier text NOT NULL,
  role text NOT NULL DEFAULT 'primary',  -- primary | fallback
  credentials_encrypted text NOT NULL,
  credentials_iv text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected',
  config jsonb DEFAULT '{}',
  last_sync_at timestamptz,
  last_error text,
  UNIQUE (location_id, role)
)
```

**Credential encryption (`credentials_encrypted` + `credentials_iv`):**

- **Required env var:** `POS_CREDENTIALS_ENCRYPTION_KEY` — 32-byte secret, base64-encoded, set in Vercel/production env (never committed).
- Algorithm: AES-256-GCM; decrypt only inside outbox workers / test-connection API — never log plaintext.
- **Key rotation (v2.1):** support dual-key decrypt (`POS_CREDENTIALS_ENCRYPTION_KEY` + `POS_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS`) during rotation window; re-encrypt all `pos_integrations` rows via admin job; retire previous key after 30 days. Document rotation runbook in ops handbook.

---

## 10. Menu / SKU mapping

Required for **AI → POS** and accurate POS push.

```sql
product_pos_mappings (
  id uuid PK,
  product_id uuid NOT NULL REFERENCES products(id),
  location_id uuid NOT NULL,
  provider text NOT NULL,
  external_sku text NOT NULL,
  external_name text,
  last_synced_at timestamptz,
  UNIQUE (product_id, location_id, provider)
)
```

| Menu source of truth | When |
|---------------------|------|
| QR Order | No POS / printer-only / dashboard-only |
| **POS → QR Order sync** | POS connected (**POS wins** — restaurant maintains menu in POS) |
| Hybrid | Manual map for unmapped items until next sync |

Admin: **Menu sync status** — mapped / unmapped / error counts.

---

## 11. Payment model (per location)

Existing columns: `payment_online_enabled`, `payment_at_bar_enabled`.

| Admin toggle | Guest UX | Sent to POS |
|--------------|----------|-------------|
| Online (Stripe) | Pay in app | `PAID` |
| Pay at register | Order only | `UNPAID` |
| Both | Guest chooses checkout | per order |

**Reconciliation (Vorsystem + Stripe):** finance export note — Stripe settlement separate from POS fiscal receipt. Future: `payment_reconciliation` report for accountants.

Requires Stripe Connect onboarded for online toggle.

---

## 12. AI Concierge integration

```
AI chat → order_draft (JSONB on ai_sessions)
AI submit → create_order() with same validation as guest
           → same outbox events
           → product_pos_mappings for POS line items
```

Idempotency: `ai:submit:{sessionId}:{draftRevision}`.

**Differentiator:** conversational order → kitchen + POS without separate AI order fork.

---

## 13. Admin UI

### 13.1 Order Delivery Channels

```
✅ Dashboard & KDS          [always on]
⬜ Cloud Printer            [Configure →]
⬜ POS Integration          [Connect →]  🔒 until Deliverect ready
     ├ Deliverect (1000+ POS)
     ├ Lightspeed (direct)
     ├ orderbird (direct)
     └ ready2order (direct)
```

### 13.2 Payment Options

```
✅ Online payment (Stripe)   [toggle]
⬜ Pay at register           [toggle]
```

### 13.3 Fiscal Compliance (read-only)

```
🟢 Vorsystem — POS handles fiscal compliance
   or
🟡 Standalone — QR Order TSE active
   → TSE settings panel (conditional)
```

### 13.4 Setup wizard (phase 6)

Question flow → derives channels + payment + shows fiscal badge.  
**Location templates** for enterprise rollout (copy config A → B).

---

## 14. Operations health (phase 7)

Per-location dashboard:

```
Dashboard/KDS     ● live
Cloud Printer     ● ok | ○ not configured | ✗ error
POS (Deliverect)  ● ok (340ms) | ✗ failing
Fiscal mode       🟢 Vorsystem | 🟡 Standalone

24h: orders, channel failure rate, avg fulfillment latency
```

Data sources: `order_channel_deliveries`, `pos_integrations`, integration ping jobs.

---

## 15. Realtime & guest experience

| Surface | Mechanism | v2 improvement |
|---------|-----------|----------------|
| Dashboard/KDS | Supabase Realtime + backup poll | Outbox-backed notify |
| Guest order tracker | Poll today | Wire existing SSE stream |
| Approval waiting | Poll today | SSE + PIN from Redis/Postgres |
| AI order status | 15s poll | Same SSE channel |

PIN reveal: **Redis or Postgres** — delete in-memory `pin-reveal-cache.ts`.

---

## 16. Feature flags

```typescript
PLATFORM_FEATURES = [
  "ai_concierge",
  "split_payments",
  "fiscal",              // standalone TSE stack
  "integration_hub",     // POS + cloud print admin
  "pos_integration",     // fulfill.push_pos handlers
  "cloud_print",         // fulfill.cloud_print handlers
  "multi_location",
  "api_access",
]
```

POS admin UI visible always; **functional connect** gated by `pos_integration` until Deliverect tested.

---

## 17. Code structure (target)

```
src/
  domain/
    order/
      create-order.command.ts
      transition-status.command.ts
      approve-access.command.ts
    fulfillment/
      build-outbox-events.ts
      resolve-fiscal-behavior.ts
    fiscal/
      tse-sign.handler.ts
  infrastructure/
    outbox/
      processor.ts
      handlers/
      enqueue-side-effects.ts
    postgres/
      order-repository.ts
  integrations/
    pos/
      types.ts
      router.ts
      adapters/
        deliverect.ts
        lightspeed.ts
        webhook.ts
      inbound/
        deliverect-webhook.ts
    print/
      cloudprnt.ts
      epos.ts
  app/api/jobs/
    outbox-process/route.ts
    tse-sign/route.ts        # existing, called by outbox
    push-to-pos/route.ts
    cloud-print/route.ts
```

---

## 18. API surface (new/changed)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/orders` | + `Idempotency-Key` header |
| POST | `/api/jobs/outbox-process` | Outbox worker |
| POST | `/api/jobs/push-to-pos` | POS push handler |
| POST | `/api/jobs/cloud-print` | Cloud print handler |
| POST | `/api/webhooks/deliverect` | POS inbound status |
| GET | `/api/admin/integrations` | Channel + fiscal status |
| PUT | `/api/admin/pos-integration` | Save POS credentials |
| POST | `/api/admin/pos-integration/test` | Test connection |
| GET | `/api/admin/operations-health` | Ops dashboard data |

---

## 19. Security & compliance

| Topic | Approach |
|-------|----------|
| POS credentials | AES-256-GCM, key `POS_CREDENTIALS_ENCRYPTION_KEY` |
| Webhook verification | HMAC per provider (Deliverect signature) |
| Idempotency keys | Scoped per location/device where possible |
| Audit | `order_events` + `order_channel_deliveries` + existing `audit_log` |
| RLS | Staff scoped to `location_id`; service role for workers |
| PCI | Stripe Connect — no card data on our servers |

---

## 20. Non-goals (this ADR)

- Full event sourcing across all aggregates
- Multi-region active-active
- Manual fiscal mode selection by restaurant
- DSFinV-K until provider guidance clear
- Menu as POS replacement for enterprise chains (POS sync preferred)

---

## 21. Implementation roadmap

**Agreed build order.** Tracks A and B are **parallel** where noted.

### Track A — Reliability foundation

| Step | Deliverable |
|------|-------------|
| **A1** | Migrations: `00061` order_events + outbox_events; `00062` idempotency_key; `00063` order_channel_deliveries |
| **A2** | `buildOutboxEvents()` + enqueue in order create/approve path |
| **A3** | Outbox processor + handler registry + dead letter alerts |
| **A4** | Idempotency on `POST /api/orders` |
| **A5** | PIN reveal → Redis/Postgres |
| **A6** | Approve/reject idempotent RPC (extend existing fixes) |
| **A7** | Migrate `scheduleNewOrderPush` → `fulfill.notify_staff` |
| **A8** | Migrate `scheduleOrderTseSign` → `fiscal.tse_sign` |

### Track B — Standalone fiscal (parallel with A)

| Step | Deliverable |
|------|-------------|
| **B1** | TSE via outbox (shared with A8) — guaranteed retry |
| **B2** | DATEV mixed-rate split (8400 + 8300 rows) |
| **B3** | Proper Beleg template |
| **B4** | Z-Bon daily job |
| **B5** | DSFinV-K export — **BLOCKED** (see below) |

**B5 — DSFinV-K blocker:** Implementation blocked until written guidance received from **fiskaly** and **fiskaltrust**. Inquiry email drafts are prepared (`docs/compliance/dsfinvk-provider-inquiry.md`); **pending Jovica approval before send**. No B5 engineering until provider response documents API/export path for Cloud TSE (standalone mode).

### Track C — POS (after A1–A3)

| Step | Deliverable |
|------|-------------|
| **C1** | `pos_integrations` + `pos_order_mappings` migrations |
| **C2** | Deliverect adapter (`pushOrder`) |
| **C3** | Deliverect inbound webhook **same release as C2** |
| **C4** | Admin POS UI unlock |
| **C5** | Direct adapters (Lightspeed, orderbird, …) |

### Track D — Menu + print (parallel with C after C2)

| Step | Deliverable |
|------|-------------|
| **D1** | `product_pos_mappings` + admin sync status |
| **D2** | CloudPRNT adapter + `fulfill.cloud_print` |
| **D3** | Admin cloud printer config |

### Track E — Enterprise UX (after channels work)

| Step | Deliverable |
|------|-------------|
| **E1** | Setup wizard |
| **E2** | Location templates |
| **E3** | Operations health dashboard |

```
Timeline (conceptual):

Week 1-2:  A1-A8 ║ B1-B2
Week 3-4:  C1-C3 ║ D2 (CloudPRNT)
Week 4-5:  D1, C4
Week 5-6:  B3-B4, E1-E2
Week 6+:   C5, E3, B5 when provider unblocks (fiskaly/fiskaltrust)
```

**Parallel workstreams (approved):**

- **Track A + Track B** may run simultaneously — no dependency between reliability outbox and standalone fiscal fixes (except B1/A8 shared TSE-outbox wiring).
- **Track C** starts after **A3** (outbox processor verified in staging).
- Two Cursor agents may own Track A and Track B respectively; single owner for migration file numbering (`00061+`).

---

## 22. Testing & SLOs

### SLOs

| Metric | Target |
|--------|--------|
| Order create atomicity | 100% |
| `fulfill.notify_staff` delivery | 99.9% &lt; 60s |
| Duplicate guest orders | 0 with idempotency key |
| PIN delivery after approve | 100% |
| POS push success (excl. POS outage) | 99.5% within 10 retries |

### Test scenarios

- [ ] Idempotent duplicate POST → same `orderId`
- [ ] POS down, printer + dashboard succeed
- [ ] Vorsystem: no `tse_signature` ever
- [ ] Standalone: TSE retried after simulated fiskaly 500
- [ ] Deliverect webhook → status sync to guest
- [ ] Mixed 7%/19% order → 2 DATEV rows
- [ ] AI submit → same outbox as checkout

---

## 23. Consequences

### Positive

- Enterprise-credible reliability and audit trail
- DE market fit (Vorsystem + standalone)
- Parallel dev tracks (fiscal ∥ reliability ∥ POS prep)
- Clear sales story: „ordering infrastructure, not another POS“

### Negative / costs

- Migration complexity from fire-and-forget
- Deliverect per-location cost passed to customer or bundled
- SKU mapping admin burden until menu sync mature
- Outbox worker = new operational component to monitor

### Risks

| Risk | Mitigation |
|------|------------|
| Atomic RPC scope creep | Phase A1: outbox insert immediately after order even before full RPC |
| Deliverect API changes | Adapter isolation + contract tests |
| Stripe + Vorsystem accounting confusion | Admin help + reconciliation export |
| Two agents conflicting migrations | Single migration sequence owner; numbered files |

---

## 24. Resolved decisions (formerly open questions)

| # | Question | **Decision** |
|---|----------|--------------|
| 1 | Deliverect vs Lightspeed direct first? | **Deliverect first** — covers 1000+ POS. **Lightspeed direct** only when a paying client requires native integration. |
| 2 | Menu source of truth when POS connected? | **POS wins** — QR Order syncs **from** POS. Restaurant already maintains menu in their Kasse. |
| 3 | Webhook-only fallback acceptable for go-live? | **Yes** — generic `webhook` adapter is minimum viable for venues without Deliverect; ship early in Track C. |
| 4 | DSFinV-K timeline? | **Blocked** — awaiting fiskaly/fiskaltrust provider response. Emails drafted; send after product owner approval. |

---

## 25. Glossary

| Term | Meaning |
|------|---------|
| **Vorsystem** | Pre-system — orders only, no fiscal duty |
| **Standalone** | QR Order is the fiscal Kasse |
| **Outbox** | DB table of pending side effects, same TX as order |
| **Fulfillment** | Getting order to kitchen (channels 1–3) |
| **Fiscal** | TSE, Beleg, DATEV, Z-Bon, DSFinV-K |
| **CloudPRNT** | Star Micronics cloud printing protocol |

---

## 26. Approval

**ADR-001 is approved** (2026-05-23).

This ADR is the **canonical architecture** for QR Order universal ordering platform. Implementation PRs should reference ADR-001. Detailed file-level notes may live in `reliability-v2-fiscal-hybrid.md` but must not contradict this document.

**Implementation start (authorized):**

| Track | First steps | Can run in parallel? |
|-------|-------------|----------------------|
| **A** | A1 migrations → A2 outbox enqueue → A3 processor | Yes, with B |
| **B** | B2 DATEV mixed-rate split; B1/A8 TSE-outbox with A | Yes, with A |

**Do not start Track C (POS/Deliverect)** until A3 outbox processor passes staging verification.

**External action (B5):** Send fiskaly + fiskaltrust DSFinV-K inquiry emails after Jovica approves drafts in `docs/compliance/dsfinvk-provider-inquiry.md`.

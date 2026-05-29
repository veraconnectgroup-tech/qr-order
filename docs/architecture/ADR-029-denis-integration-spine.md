# ADR-029: Denis Integration Spine

| Field | Value |
|-------|--------|
| **Status** | **Accepted** — integration north star |
| **Date** | 2026-05-29 |
| **Product** | **Denis** — global platform + Table OS |
| **Parent** | [DENIS-TABLE-OS-ARCHITECTURE.md](./DENIS-TABLE-OS-ARCHITECTURE.md) §7 · [ADR-001](./ADR-001-universal-ordering-platform.md) §9 |
| **Partner instance** | [ADR-028 Viktor](./ADR-028-viktor-denis-integration.md) — first **operator** connector |
| **Implement** | [VIKTOR-DENIS-CURSOR-PROMPTS.md](./VIKTOR-DENIS-CURSOR-PROMPTS.md) · [ADR-028-session-prompts.md](./ADR-028-session-prompts.md) |

---

## 0. One sentence

**Every external system — Viktor, POS, delivery, accounting — touches Denis only through typed, audited, versioned contracts on the TRUTH boundary; guest and staff paths never import integration code.**

---

## 1. Why this ADR exists

We already decided:

- Denis **standalone** at the table  
- Viktor **reads** Denis (Operator API + webhooks), never blocks guest  
- **Write = proposal** — owner approves  
- **Global core** — connectors, not country forks  

ADR-028 defines the **Viktor partner contract**. ADR-029 defines the **integration architecture** that makes Viktor connector #1 of many — without special cases in guest code.

```
┌──────────────────────────────────────────────────────────────┐
│  ADR-029  Integration Spine     ← this doc (how all connect) │
│  ADR-028  Viktor partner        ← first operator consumer  │
│  DENIS-TABLE-OS §18             ← locked product decisions │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Integration philosophy

| Principle | Meaning |
|-----------|---------|
| **TRUTH is inside** | Timeline, orders, journal — only ACT + outbox mutate |
| **Egress is read-only by default** | Operator API, webhooks, exports — projections of TRUTH |
| **Ingress is validated** | External webhooks/POS events → normalized signals → loop |
| **No shadow DB** | Partners cache summaries; Denis remains source of replay |
| **Contract-first** | OpenAPI + event schemas before partner code |
| **Guest isolation** | Zero `operator/` or `integrations/` imports in hot path |
| **Async by default** | Push events; never sync wait on partner AI |
| **One org scope** | Every key, webhook, connector bound to `org_id` |

These extend [DENIS-TABLE-OS §18](./DENIS-TABLE-OS-ARCHITECTURE.md) — not replace them.

---

## 3. Three integration channels

All integrations use **one or more** of these channels. No fourth “back door”.

```
                    ┌─────────────────────────────────┐
                    │         EXTERNAL SYSTEMS         │
                    │  Viktor · Toast · Deliverect · … │
                    └───────┬─────────┬─────────┬─────┘
                            │         │         │
              ┌─────────────┘         │         └─────────────┐
              ▼                       ▼                       ▼
     ┌────────────────┐    ┌────────────────┐    ┌────────────────┐
     │  A · EGRESS     │    │  B · INGRESS    │    │  C · CONNECTOR  │
     │  (Denis → out)  │    │  (in → Denis)   │    │  (bidirectional)│
     ├────────────────┤    ├────────────────┤    ├────────────────┤
     │ Operator API   │    │ POS webhook in  │    │ Outbox job      │
     │ Webhooks HMAC    │    │ Delivery status │    │ Catalog sync    │
     │ Batch export     │    │ Payment IPN     │    │ Order push      │
     └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘
              │                       │                       │
              └───────────────────────┼───────────────────────┘
                                      ▼
                    ┌─────────────────────────────────┐
                    │  INTEGRATION GATEWAY (lib layer) │
                    │  auth · audit · idempotency ·   │
                    │  schema validate · rate limit    │
                    └─────────────────┬───────────────┘
                                      ▼
                    ┌─────────────────────────────────┐
                    │  TRUTH + TABLE OS                │
                    │  timeline · orders · outbox · ACT│
                    └─────────────────────────────────┘
```

### 3.1 Channel A — Egress (Denis → partner)

**Purpose:** Partners observe Denis without DB access.

| Surface | Auth | Mutates TRUTH? |
|---------|------|----------------|
| `GET /api/operator/v1/*` | `dns_op_*` bearer + org | ❌ read only |
| Webhooks (`dispatch.ts`) | HMAC per endpoint | ❌ fire-and-forget |
| Nightly export (DATEV, etc.) | internal cron | ❌ |

**Viktor uses:** Operator API + `denis.*` webhooks — see [ADR-028 §4–5](./ADR-028-viktor-denis-integration.md).

### 3.2 Channel B — Ingress (partner → Denis)

**Purpose:** External facts enter as **signals**, not direct SQL.

```
Partner POST → validate schema → idempotency key → normalize to WorldSignal / CommerceSignal
  → outbox or direct loop ingress → FOLD → view
```

Examples: POS order status, delivery ETA, payment webhook (Stripe already on this path).

**Rule:** ingress never calls LLM; never patches `orders` without Order Core pipeline.

### 3.3 Channel C — Connectors (outbox-driven)

**Purpose:** Reliable side effects to external systems (ADR-001 outbox pattern).

```
Order committed → outbox event → handler → adapter.pushOrder()
```

Categories: `pos` · `delivery` · `payment` · `hardware` · `operator` · `accounting` · `crm`

**Viktor is `category: operator`** with capabilities `read_analytics`, `webhook_out` — not `push_order`.

---

## 4. Connector model (Viktor is not special)

```typescript
type ConnectorDefinition = {
  id: string;                              // "viktor" | "toast" | "deliverect"
  category: ConnectorCategory;
  auth: "oauth" | "api_key" | "hmac_webhook";
  capabilities: ConnectorCapability[];
  /** Which egress events this connector may subscribe to */
  webhookEvents?: WebhookEvent[];
  /** Which Operator API scopes required (operator category only) */
  operatorScopes?: ("operator:read" | "operator:propose")[];
};

type ConnectorCategory =
  | "pos"
  | "delivery"
  | "payment"
  | "hardware"
  | "operator"      // Viktor, future BI tools
  | "accounting"
  | "crm";
```

**Registry target:** `src/lib/integrations/registry.ts`  
**Today:** partial — webhooks + outbox handlers; Operator API = next build (P1).

**Anti-pattern:** `if (connectorId === "viktor")` in guest or order code. Viktor-specific UX lives in **admin connect flow** and **ADR-028 docs**, not runtime branches.

---

## 5. Operator API (Channel A — operator category)

Canonical spec: [ADR-028 §4](./ADR-028-viktor-denis-integration.md).

ADR-029 adds **structural rules**:

| Rule | Detail |
|------|--------|
| Base path | `/api/operator/v1/` only — never `/api/v2/` |
| Version header | `X-Denis-Operator-Api-Version: 1` |
| Scopes | `operator:read` (P1) · `operator:propose` (V5) |
| Audit | Every request → `operator_api_audit` |
| Rate limit | Per org, configurable (default 100/min) |
| Response shape | Stable TypeScript types exported from `src/lib/operator/types.ts` |
| OpenAPI | `docs/openapi/denis-operator-v1.yaml` (V3 phase) |

**Implementation layout:**

```
src/lib/operator/
  auth.ts              verify bearer, scope, org binding
  audit.ts             append audit row
  types.ts             LocationSummary, SessionSummary, …
  projections/         read TRUTH → DTO (no raw SQL in routes)
src/app/api/operator/v1/
  locations/…
  sessions/…
  config/proposals/…   (V5)
```

Routes are **thin** — auth → projection → JSON. Business logic in projections.

---

## 6. Webhooks (Channel A — push egress)

Extend [src/lib/webhooks/events.ts](../../src/lib/webhooks/events.ts) + outbox dispatch.

### 6.1 Event layers

| Layer | Events | Consumers |
|-------|--------|-----------|
| **Commerce** (existing) | `order.*`, `session.opened/closed` | POS, CRM, Viktor |
| **Denis operator** (new) | `denis.session.completed`, `denis.session.converted`, `denis.metrics.daily_ready`, `denis.alert.*` | Viktor, owner automations |
| **Integration** (future) | `connector.sync.failed` | admin alerts |

Full list: [ADR-028 §5.2](./ADR-028-viktor-denis-integration.md).

### 6.2 Payload contract

Every webhook payload:

```typescript
type WebhookEnvelope<T> = {
  id: string;                    // delivery id
  type: WebhookEvent;
  apiVersion: "2026-05-29";      // schema version — bump on breaking change
  createdAt: string;             // ISO
  orgId: string;
  locationId?: string;
  data: T;
  traceId?: string;
};
```

- **No guest PII** by default  
- HMAC-SHA256 signature (existing `dispatch.ts` pattern)  
- Retries with exponential backoff + dead-letter in outbox  
- Idempotency: partners dedupe on `id`

### 6.3 Emission rule

Webhooks fire from **outbox handlers only** — never fire-and-forget duplicate path (commit checklist §1).

---

## 7. Write path — proposals only

External systems **never** PATCH menu, config, or playbook directly.

```
Partner POST /api/operator/v1/config/proposals
  → proposal row (pending)
  → webhook denis.config.proposal.created
  → owner approves in admin (or Slack deep link)
  → Denis applies + audit + optional webhook
```

Same for playbook suggestions. Scope: `operator:propose` (separate key from read).

**Rationale:** fiscal config, allergen copy, and AI examples are **liability surfaces** — human or owner-role approval required.

---

## 8. Guest path isolation (non-negotiable)

```
src/lib/denis/runtime/run-denis-signal.ts
src/lib/denis/loop/*
src/components/guest/*
```

**Must NOT import:**

- `src/lib/operator/*`
- Viktor SDK (none in repo)
- Partner-specific env vars checked in turn path

**Allowed:** world signals that originated from ingress (normalized, no partner identity in prompt).

**CI guard (target):** lint rule or test that greps guest/denis hot path for `operator/` imports.

---

## 9. Contract-first delivery

| Artifact | Phase | Owner |
|----------|-------|-------|
| TypeScript DTOs in `src/lib/operator/types.ts` | I1 (P1) | Denis |
| Webhook event union + Zod schemas | I2 (P2) | Denis |
| OpenAPI `denis-operator-v1.yaml` | I3 (V3) | Denis |
| Sandbox org + test keys in admin | I3 | Denis |
| Contract tests (`operator-api.test.ts`, webhook fixture tests) | I1–I2 | Denis |
| Viktor Skill (consumer) | I4 (V4) | Partner |

**Breaking changes:** bump `apiVersion` or Operator API version header; never silent field removal.

---

## 10. Observability & audit

| Event | Stored |
|-------|--------|
| Operator API request | `operator_api_audit` (method, path, org, key id, latency, status) |
| Webhook delivery | existing outbox delivery log |
| Proposal lifecycle | `operator_proposals` + timeline |
| Ingress | `integration_ingress_log` (target) — idempotency key, source connector |

Owner admin: **Integrations → Activity** — unified view of API + webhook health.

---

## 11. Replay & contract testing

Integration quality is proven, not assumed.

### 11.1 Projection tests

```
fixture timeline + orders → projectLocationSummary() → snapshot assert
```

No LLM. Fast CI. Catches metric regressions before Viktor sees bad data.

### 11.2 Webhook golden files

```
src/lib/integrations/fixtures/webhooks/denis.session.completed.v1.json
→ validate schema → assert HMAC helper
```

### 11.3 End-to-end sandbox

Sandbox org with synthetic sessions → Operator API smoke → webhook receiver stub.

**Gate before Viktor V4:** I1 + I2 contract tests green; O1 waiter eval ≥ 95%.

---

## 12. Data & privacy (all connectors)

| Data | Operator API | Webhook default | Notes |
|------|--------------|-----------------|-------|
| Revenue, order counts | ✅ | ✅ | |
| Denis conversion, LLM rate | ✅ | ✅ | cognition quality telemetry |
| Session summary (redacted) | ✅ | ✅ | |
| Full transcript | ⚠️ opt-in | ❌ | `?include=pii` + audit |
| Guest fingerprint / card | ❌ | ❌ | never |

Retention: partner cache ≤ 90d per DPA; Denis TRUTH = system of record.

---

## 13. Implementation phases (I-track)

Aligns with [VIKTOR-DENIS-CURSOR-PROMPTS.md](./VIKTOR-DENIS-CURSOR-PROMPTS.md).

| Phase | Deliverable | Depends on | Unblocks |
|-------|-------------|------------|----------|
| **I0** | ADR-025 + waiter eval O1 | — | quality gate |
| **I1** | Operator API read + audit + projections | I0 | Viktor read |
| **I2** | `denis.*` webhooks + session outcome rollup | I0, world O2 | Viktor push |
| **I3** | OpenAPI + sandbox + contract tests | I1, I2 | Viktor dev |
| **I4** | Admin Connect UI (generic connector) | I1 | self-serve |
| **I5** | Config/playbook proposals | I1 | Viktor propose |
| **I6** | Ingress adapters (POS in) | outbox | multi-POS |
| **Partner V4** | Viktor Skill | I1–I3 | GTM |

**Do not start I1 until I0 gate passes** — empty or wrong metrics destroy partner trust.

---

## 14. Code layout (target tree)

```
src/lib/integrations/
  registry.ts                 connector definitions
  types.ts                    shared integration types
  ingress/
    normalize-signal.ts       partner payload → WorldSignal
    verify-hmac.ts
  egress/
    build-webhook-payload.ts
  fixtures/                   golden webhook + API snapshots

src/lib/operator/             Channel A — operator category
  auth.ts · audit.ts · types.ts
  projections/
    location-summary.ts
    session-summary.ts
    denis-metrics.ts

src/lib/webhooks/             existing — extend events.ts
src/lib/outbox/handlers/      commerce + denis.operator.* dispatch

src/app/api/operator/v1/      thin HTTP routes
```

Guest path stays under `src/lib/denis/` — no new coupling.

---

## 15. Relationship to other ADRs

| ADR | Role |
|-----|------|
| ADR-001 | Order Core, outbox, idempotency — Channel C foundation |
| ADR-019 | signal/view — ingress ends as signal |
| ADR-028 | Viktor-specific endpoints, GTM, partner modes |
| ADR-025 | Cognition quality — feeds `denis.*` metrics |
| DENIS-TABLE-OS §18–19 | Locked product + flywheel |

---

## 16. Anti-patterns (reject in review)

1. Partner reads Supabase with service role  
2. Viktor (or any AI) in `runDenisSignal` await path  
3. Direct `PATCH /menu` or config from Operator API  
4. Fire-and-forget webhook beside outbox handler  
5. Viktor-only branches in order or guest code  
6. Webhook payload without `apiVersion`  
7. Operator API route with inline SQL (use projections)  
8. Integration before Denis cognition gate (I0)  

---

## 17. Success metrics

| Metric | Target |
|--------|--------|
| Guest path imports from `operator/` | **0** |
| Operator API p99 read | < 500ms |
| Webhook delivery success | > 99% |
| Contract test coverage (I1/I2 DTOs) | 100% fields documented |
| Projection snapshot tests | ≥ 10 KPI scenarios |
| Connected org weekly active (operator tier) | > 60% pilot |

---

## 18. Summary

**Best integration architecture for Denis** = one TRUTH boundary, three channels, contract-first egress, signal-normalized ingress, Viktor as first operator connector — **not** a parallel brain or special-case hack.

Build: **I0 quality → I1 Operator API → I2 webhooks → I3 contracts → partner V4**.

---

*End of ADR-029*

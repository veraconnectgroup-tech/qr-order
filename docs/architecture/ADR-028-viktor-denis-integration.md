# ADR-028: Viktor × Denis — Partner Integration Architecture

| Field | Value |
|-------|--------|
| **Status** | **Accepted** — planned product offering |
| **Date** | 2026-05-29 |
| **Product** | **Denis** (platform + Table OS) · **Viktor** ([partner operator AI](https://viktor.com/integrations)) |
| **Parent** | [DENIS-TABLE-OS-ARCHITECTURE.md](./DENIS-TABLE-OS-ARCHITECTURE.md) |
| **Spine** | [ADR-029 Integration architecture](./ADR-029-denis-integration-spine.md) — Viktor = operator connector #1 |
| **Implements** | Plane 5 (Enterprise/Operator) + Viktor connector in Plane 4 |
| **Session prompts** | [ADR-028-session-prompts.md](./ADR-028-session-prompts.md) · [VIKTOR-DENIS-CURSOR-PROMPTS.md](./VIKTOR-DENIS-CURSOR-PROMPTS.md) |

---

## 0. One sentence

**Denis runs the table and owns TRUTH; Viktor runs the owner’s Slack — reading Denis Operator API and webhooks to monitor, analyze, and recommend, never blocking the guest.**

### Viktor’s broader job (clarification)

Viktor is **not** a second Denis. Viktor is a **wider operator AI** (Stripe, CRM, ads, Slack, …) for which **Denis is one rich data connector** — hospitality POS + Table OS + session metrics. Integration = **data pipeline out of Denis**, not co-brain at the table.

```
Denis (standalone, 100% guest/staff)  ──read/webhook──►  Viktor (analyze, report, propose)
                              ▲
                              └── never waits on Viktor
```

---

## 1. What we sell (product bundle)

This is **not** optional add-on documentation — Viktor integration is part of the **Denis enterprise story**.

| Tier | Buyer gets | Viktor role |
|------|------------|-------------|
| **Denis Core** | QR ordering, POS, KDS, payments, Table OS | — |
| **Denis + Operator** | Above + Viktor connector enabled | Owner asks in Slack: KPI, sessions, alerts |
| **Denis Chain** | Multi-location + manifest + audit | Viktor cross-venue reports, config proposals |

**Pitch:** *Denis is the head waiter on every table. Viktor is the ops director in Slack — both read the same truth.*

---

## 2. Division of responsibility (hard rules)

```
┌─────────────────────────────────────────────────────────────┐
│  GUEST / STAFF AT TABLE                                      │
│  Only Denis — signal/view, <3s, ACL, fiscal                │
└────────────────────────────▲────────────────────────────────┘
                             │ TRUTH (timeline, orders, metrics)
┌────────────────────────────┴────────────────────────────────┐
│  DENIS PLATFORM                                              │
│  Table OS · Order Core · Operator API · webhooks             │
└────────────────────────────▲────────────────────────────────┘
                             │ HTTPS read + signed webhooks
┌────────────────────────────┴────────────────────────────────┐
│  VIKTOR (partner)                                            │
│  Analyze · report · propose config · owner Q&A in Slack      │
└─────────────────────────────────────────────────────────────┘
```

| Rule | Rationale |
|------|-----------|
| Viktor **never** in guest request path | Latency, ACL, single brain |
| Viktor **reads** Operator API + webhooks | Same data model as admin, audited |
| Viktor **proposes** config changes | Owner approves in Slack/admin — no direct PATCH |
| Denis **emits** rich telemetry | Viktor value = quality of Denis data |
| One `org_id` scopes all API keys | Multi-tenant security |

---

## 3. Why Denis must be at the peak first

Viktor integration **amplifies** Denis — it does not fix a dumb Denis.

| If Denis is weak | Viktor sees | Outcome |
|------------------|-------------|---------|
| banter.welcome on „Može“ | 40% failed sessions | Owner blames both products |
| No world push | Missing order-ready events | „Viktor doesn’t know kitchen“ |
| No Operator metrics | Empty API | Connector useless |

**Prerequisite gate (non-negotiable):**

```
O0 ADR-025 shipped
O1 waiter parity eval ≥ 95%
O2 world events in webhooks
→ then O4 Operator API for Viktor
```

---

## 4. Denis Operator API (we build)

Viktor Skill on their side; **we own the API contract**.

### 4.1 Auth

```
Authorization: Bearer dns_op_live_{token}
Header: X-Denis-Org-Id: {uuid}
Scope: operator:read | operator:propose (future)
```

- Keys issued in Denis admin → Integrations → Viktor  
- Every request → `operator_api_audit` table  
- Rate limit: **100 req/min per org** (`withOperatorOrgRateLimit` — keyed on authenticated `orgId`)

### 4.2 Read endpoints (P0)

| Method | Path | Viktor use |
|--------|------|------------|
| GET | `/api/operator/v1/locations` | List venues |
| GET | `/api/operator/v1/locations/:id/summary` | Today KPI rollup |
| GET | `/api/operator/v1/locations/:id/denis/metrics` | Conversion, credits, LLM rate |
| GET | `/api/operator/v1/locations/:id/orders` | Open + recent orders |
| GET | `/api/operator/v1/locations/:id/orders/:orderId` | Single order + line items |
| GET | `/api/operator/v1/locations/:id/commerce/insights` | Revenue, menu mix, payments |
| GET | `/api/operator/v1/locations/:id/fiscal/daily-closing` | Z-Bon / daily closing for accounting |
| GET | `/api/operator/v1/locations/:id/learnings` | Denis accumulated venue knowledge |
| GET | `/api/operator/v1/sessions` | Filter: date, status, location |
| GET | `/api/operator/v1/sessions/:id/summary` | Transcript summary (redacted) |
| GET | `/api/operator/v1/sessions/:id/transcript` | Full turn list (optional PII flag) |

### 4.3 Write endpoints (P1 — proposal only)

| Method | Path | Flow |
|--------|------|------|
| POST | `/api/operator/v1/config/proposals` | Viktor → proposal record |
| GET | `/api/operator/v1/config/proposals/:id` | Owner status |
| POST | `/api/operator/v1/playbook/proposals` | Suggested ai_examples |

Owner approves in admin or Slack link → Denis applies + audit.

### 4.4 Response shape (stable contract)

```typescript
type LocationSummary = {
  locationId: string;
  period: { from: string; to: string };
  commerce: {
    ordersCount: number;
    revenueCents: number;
    avgCheckCents: number;
    tipRate?: number;
  };
  denis: {
    sessionsCount: number;
    sessionsWithOrder: number;
    conversionRate: number;
    escalationsCount: number;
    avgTurnsPerSession: number;
    topLanguages: Array<{ lang: string; count: number }>;
    llmInvocationRate: number;
  };
  ops: {
    rushMinutes: number;
    openWaiterCalls: number;
    kdsBacklog?: number;
  };
};
```

Version header: `X-Denis-Operator-Api-Version: 1`

---

## 5. Webhooks (Denis → Viktor)

Extend `src/lib/webhooks/events.ts` + outbox dispatch.

### 5.1 Existing (reuse)

`order.created` · `order.paid` · `order.status_changed` · `session.opened` · `session.closed`

### 5.2 Denis operator events (new)

```typescript
const DENIS_OPERATOR_EVENTS = [
  "denis.session.completed",      // session ended — outcome: ordered | abandoned
  "denis.session.converted",      // first order in session
  "denis.metrics.daily_ready",    // rollup for cron consumers
  "denis.alert.conversion_drop",  // week-over-week threshold
  "denis.alert.credit_low",
  "denis.alert.circuit_open",
  "denis.config.proposal.created",
] as const;
```

Payload includes: `orgId`, `locationId`, `sessionId?`, `metrics?`, `traceId` — **no raw guest PII by default**.

### 5.3 Delivery

Same HMAC as today (`dispatch.ts`). Viktor registers webhook URL in Denis admin or OAuth connect flow.

---

## 6. Viktor modes (what partner builds)

We document; Viktor implements Skill.

| Mode | Trigger | Denis dependency |
|------|---------|------------------|
| **Monitor** | Webhook + cron | Operator API summary |
| **Ask** | Owner Slack question | metrics + sessions API |
| **Analyze** | Nightly batch | sessions + transcript summary |
| **Propose** | Pattern detected | playbook/config proposal API |
| **Alert** | conversion_drop webhook | Slack DM owner |

**Explicitly out of scope:** real-time guest escalation (guest waits on Viktor). Use Denis handoff + async alert.

---

## 7. Data & privacy

| Data | Operator API | Default |
|------|--------------|---------|
| Order totals, counts | ✅ | always |
| Denis conversion metrics | ✅ | always |
| Transcript text | ⚠️ | summary only; full with `?include=pii` + audit |
| Guest fingerprint | ❌ | never |
| Payment instrument | ❌ | never |

GDPR: data processing agreement with Viktor; retention max 90d on summaries for partner cache.

---

## 8. Marketplace & flywheel

```
Denis pilot venue → strong metrics → Viktor Skill highlights Denis connector
→ new venues connect Denis → more training signal for Viktor reports
→ Viktor recommends „Connect Denis POS“ in hospitality vertical
```

**We win when:** Operator API is best-in-class hospitality feed — richer than Stripe alone (orders + AI sessions + floor ops).

---

## 9. Implementation phases

| Phase | Deliverable | Owner |
|-------|-------------|-------|
| **V0** | ADR-025 + waiter eval | Denis eng |
| **V1** | Operator API read (§4.2) + audit | Denis eng |
| **V2** | Webhook events (§5.2) + admin UI register | Denis eng |
| **V3** | OpenAPI spec + sandbox org for Viktor dev | Denis eng |
| **V4** | Viktor Skill (read-only) | Viktor partner |
| **V5** | Config/playbook proposals (§4.3) | Denis + Viktor |
| **V6** | Marketplace listing joint GTM | Product |

Aligns with [DENIS-TABLE-OS-ARCHITECTURE.md](./DENIS-TABLE-OS-ARCHITECTURE.md) O4.

---

## 10. Architecture invariants (review checklist)

- [ ] Guest path has zero imports from `operator/` or Viktor SDK  
- [ ] Operator API never mutates TRUTH without admin approval flow  
- [ ] Webhook payloads documented in OpenAPI  
- [ ] Every Operator call audited  
- [ ] Denis metrics include cognition quality (conversion, not just revenue)  
- [ ] Viktor docs list Denis as „hospitality connector“ with setup wizard  

---

## 11. Success metrics (joint)

| KPI | Target |
|-----|--------|
| Operator API p99 | < 500ms read |
| Webhook delivery success | > 99% |
| Owner weekly active (Viktor + Denis connected) | > 60% pilot orgs |
| „Ask Viktor about Denis“ queries/session | growing WoW |
| Denis conversion visible in Viktor | 100% connected orgs |

---

*End of ADR-028*

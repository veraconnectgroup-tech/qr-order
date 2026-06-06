# Viktor × Denis — Integration Handoff

> Contract: [ADR-028](./ADR-028-viktor-denis-integration.md) · Spine: [ADR-029](./ADR-029-denis-integration-spine.md)  
> OpenAPI: [denis-operator-v1.yaml](../openapi/denis-operator-v1.yaml)

## Base URLs

| Environment | Base URL |
|-------------|----------|
| Production | `https://{your-domain}/api/operator/v1` |
| Preview | `https://{vercel-preview}/api/operator/v1` |

## Authentication

```
Authorization: Bearer dns_op_live_{token}
X-Denis-Org-Id: {org-uuid}          # optional binding check
X-Denis-Operator-Api-Version: 1     # response header (always returned)
```

Keys are created in **Denis Admin → Settings → Operator API keys (Viktor)**.  
Scope `operator:read` for GET endpoints. Scope `operator:propose` for proposal POSTs.

Rate limit: **100 requests/minute** per deployment (scope `operator`).

## Read endpoints (curl examples)

Replace `DOMAIN`, `ORG_ID`, and `KEY`.

### List locations

```bash
curl -sS "https://DOMAIN/api/operator/v1/locations" \
  -H "Authorization: Bearer dns_op_live_KEY" \
  -H "X-Denis-Org-Id: ORG_ID"
```

### Location summary (today KPI)

```bash
curl -sS "https://DOMAIN/api/operator/v1/locations/LOCATION_ID/summary?period=today" \
  -H "Authorization: Bearer dns_op_live_KEY"
```

### Denis metrics

```bash
curl -sS "https://DOMAIN/api/operator/v1/locations/LOCATION_ID/denis/metrics?period=7d" \
  -H "Authorization: Bearer dns_op_live_KEY"
```

### Orders (open + recent)

```bash
curl -sS "https://DOMAIN/api/operator/v1/locations/LOCATION_ID/orders?status=open&limit=50" \
  -H "Authorization: Bearer dns_op_live_KEY"
```

### Sessions

```bash
curl -sS "https://DOMAIN/api/operator/v1/sessions?locationId=LOCATION_ID&converted=true" \
  -H "Authorization: Bearer dns_op_live_KEY"
```

### Session summary

```bash
curl -sS "https://DOMAIN/api/operator/v1/sessions/SESSION_ID/summary" \
  -H "Authorization: Bearer dns_op_live_KEY"
```

### Session transcript (redacted default)

```bash
curl -sS "https://DOMAIN/api/operator/v1/sessions/SESSION_ID/transcript" \
  -H "Authorization: Bearer dns_op_live_KEY"
```

With PII audit flag:

```bash
curl -sS "https://DOMAIN/api/operator/v1/sessions/SESSION_ID/transcript?include=pii" \
  -H "Authorization: Bearer dns_op_live_KEY"
```

## Webhooks

Register HTTPS URL in **Admin → Settings → Webhooks**. Subscribe to `denis.*` events.

### HMAC verification (Node example)

```javascript
import { createHmac, timingSafeEqual } from "crypto";

function verifyWebhook(secret, rawBody, signatureHeader) {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = signatureHeader.replace(/^sha256=/, "");
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}
```

Headers on delivery:

- `X-Webhook-Signature: sha256={hex}`
- `X-Webhook-Event: denis.session.completed`
- `X-Webhook-Id: {uuid}`

### Sample payloads

**denis.session.completed**

```json
{
  "orgId": "uuid",
  "locationId": "uuid",
  "sessionId": "uuid",
  "outcome": "ordered",
  "traceId": "trace-uuid",
  "created_at": "2026-05-29T12:00:00.000Z",
  "apiVersion": "2026-05-29"
}
```

**denis.session.converted**

```json
{
  "orgId": "uuid",
  "locationId": "uuid",
  "sessionId": "uuid",
  "metrics": { "orderId": "uuid" },
  "created_at": "2026-05-29T12:00:00.000Z"
}
```

**denis.metrics.daily_ready**

```json
{
  "orgId": "uuid",
  "locationId": "uuid",
  "metrics": { "insightDate": "2026-05-28", "insightCount": 4 },
  "created_at": "2026-05-29T06:00:00.000Z"
}
```

**denis.alert.conversion_drop** · **denis.alert.credit_low** · **denis.alert.circuit_open** — see OpenAPI event list.

## Sandbox org setup

1. Create a pilot org in Denis admin (no secrets in repo).
2. Enable AI concierge on one location.
3. Generate `dns_op_live_*` key in Operator API keys panel.
4. Add webhook URL with `denis.*` events selected.
5. Run guest sessions + place test orders to populate metrics.

## Proposals (operator:propose)

```bash
curl -sS -X POST "https://DOMAIN/api/operator/v1/config/proposals" \
  -H "Authorization: Bearer dns_op_live_PROPOSE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"locationId":"LOCATION_ID","patch":{"persona":{"tone":"warm_short"}},"reason":"Viktor: improve conversion"}'
```

Owner approves in **Admin → Operator config proposals**. Direct PATCH is not supported.

## Migrations

| Migration | Purpose |
|-----------|---------|
| `00113_operator_api.sql` | `operator_api_keys`, `operator_api_audit` |
| `00115_config_proposals.sql` | `operator_config_proposals`, `config_change_log` |

Apply per [ADR-001-safe-rollout.md](./ADR-001-safe-rollout.md) — never `db reset` on production remote.

## Viktor builds (out of scope for Denis repo)

- Viktor Skill read-only (Slack Ask / Monitor / Analyze)
- V5 propose flow consumption
- Marketplace listing / GTM

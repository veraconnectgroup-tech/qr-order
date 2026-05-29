# ADR-028 — Viktor × Denis Session Prompts

> **Architecture:** [ADR-028-viktor-denis-integration.md](./ADR-028-viktor-denis-integration.md)  
> **Parent:** [DENIS-TABLE-OS-ARCHITECTURE.md](./DENIS-TABLE-OS-ARCHITECTURE.md)

---

## Status

| Phase | Scope | Status |
|-------|-------|--------|
| **V0** | ADR-025 + waiter eval (prerequisite) | 🔲 |
| **V1** | Operator API read + audit | 🔲 |
| **V2** | Webhooks + admin register | 🔲 |
| **V3** | OpenAPI + sandbox | 🔲 |

**Do not start V1 until V0 gate passes.**

---

## V1 — Operator API read

```
ADR-028 V1 — Denis Operator API (Viktor partner read path).

Pročitaj ADR-028-viktor-denis-integration.md §4.

Implement:
- src/lib/operator/auth.ts — API key verify, scope operator:read, org bind
- src/lib/operator/audit-log.ts — log every request
- src/lib/operator/build-location-summary.ts — aggregate orders + denis sessions
- src/app/api/operator/v1/locations/route.ts
- src/app/api/operator/v1/locations/[locationId]/summary/route.ts
- src/app/api/operator/v1/locations/[locationId]/denis/metrics/route.ts
- src/app/api/operator/v1/sessions/route.ts (filters: date, locationId, converted)
- src/app/api/operator/v1/sessions/[sessionId]/summary/route.ts (redacted transcript)

Migration: operator_api_keys, operator_api_audit (RLS org-scoped)

Tests: src/__tests__/operator-api.test.ts

Gate: type-check, test:run, build. Ne commit-uj.
```

---

## V2 — Webhooks

```
ADR-028 V2 — Denis operator webhooks for Viktor.

Pročitaj ADR-028 §5.

Extend src/lib/webhooks/events.ts with denis.session.completed, denis.metrics.daily_ready, denis.alert.conversion_drop.

Emit from outbox after session close / daily cron — single path, no duplicate dispatch.

Admin UI: allow webhook URL + events filter for operator tier orgs.

Tests + outbox handler. Ne commit-uj.
```

---

## V3 — OpenAPI

```
ADR-028 V3 — OpenAPI spec for Viktor dev team.

Generate docs/openapi/denis-operator-v1.yaml from route handlers.
Sandbox org + test API key in README section of ADR-028.

Ne commit-uj secrets.
```

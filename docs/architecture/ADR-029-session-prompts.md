# ADR-029 — Integration Spine Session Prompts

> **Architecture:** [ADR-029-denis-integration-spine.md](./ADR-029-denis-integration-spine.md)  
> **Viktor detail:** [ADR-028](./ADR-028-viktor-denis-integration.md) · [VIKTOR-DENIS-CURSOR-PROMPTS.md](./VIKTOR-DENIS-CURSOR-PROMPTS.md)

---

## Track map

| Track | Prompt source | Phase |
|-------|---------------|-------|
| Cognition gate | [VIKTOR-DENIS-CURSOR-PROMPTS.md § P0](./VIKTOR-DENIS-CURSOR-PROMPTS.md) | I0 |
| Operator API | [VIKTOR-DENIS-CURSOR-PROMPTS.md § P1](./VIKTOR-DENIS-CURSOR-PROMPTS.md) | I1 |
| Webhooks | [VIKTOR-DENIS-CURSOR-PROMPTS.md § P2](./VIKTOR-DENIS-CURSOR-PROMPTS.md) | I2 |
| Audit | [VIKTOR-DENIS-CURSOR-PROMPTS.md § P4](./VIKTOR-DENIS-CURSOR-PROMPTS.md) | I1 |
| Proposals | [VIKTOR-DENIS-CURSOR-PROMPTS.md § V5](./VIKTOR-DENIS-CURSOR-PROMPTS.md) | I5 |

**Use VIKTOR-DENIS-CURSOR-PROMPTS.md for copy-paste agent blocks.** This file adds I-track-only tasks.

---

## I3 — Contract-first (after I1 + I2)

```
## ZADATAK

ADR-029 §9 contract-first. OpenAPI + golden fixtures + projection snapshot tests.

## FAJLOVI

- docs/openapi/denis-operator-v1.yaml — from src/lib/operator/types.ts
- src/lib/integrations/fixtures/webhooks/*.json — one per denis.* event
- src/__tests__/operator-api.test.ts — auth, 401, org scope, snapshot DTOs
- src/__tests__/operator-projections.test.ts — timeline fixture → LocationSummary

## PRAVILA

- Svaki webhook payload ima apiVersion
- Guest path grep: zero imports operator/
- Ne commit-uj osim ako operator kaže

## GATE

pnpm test:run src/__tests__/operator*.test.ts
pnpm type-check && pnpm lint && pnpm build
```

---

## I4 — Admin Connect (generic connector UI)

```
## ZADATAK

Admin → Integrations → Connect operator connector (Viktor first skin, generic model).

## MODEL

connector_id, org_id, webhook_url, events[], api_key_id (issued), status

## UI

- Issue/revoke dns_op_* key with operator:read scope
- Register webhook URL + event checkboxes (denis.* + commerce)
- Activity tab: last 50 API calls + webhook deliveries (from audit tables)

## NE

- Viktor SDK u guest app
- Hardcode "viktor" u order/denis runtime

## GATE

Manual: issue key → curl GET /api/operator/v1/locations → 200 + audit row
```

---

## Operator one-liner

```
ADR-029 Integration Spine. Pročitaj ADR-029 + VIKTOR-DENIS-CURSOR-PROMPTS.md.
Gate I0 zelen → implementiraj sledeći I-track. Guest path bez operator/ importa. Testovi PASS.
```

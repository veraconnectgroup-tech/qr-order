# Viktor × Denis — Ispravljeni Cursor Promptovi

> **Integration spine:** [ADR-029-denis-integration-spine.md](./ADR-029-denis-integration-spine.md)  
> **Viktor contract:** [ADR-028-viktor-denis-integration.md](./ADR-028-viktor-denis-integration.md) · [DENIS-TABLE-OS-ARCHITECTURE.md](./DENIS-TABLE-OS-ARCHITECTURE.md) · [ADR-025](./ADR-025-tde-state-driven-routing.md)  
> **Pravilo:** Denis = standalone na stolu. Viktor = posmatrač + širi operator preko **Operator API + webhooks**. **Nikad** sync escalation u guest path.

---

## Redosled

```
P0  ADR-025 TDE (relational vs transactional)     ← Denis pametan
P1  Operator API read (/api/operator/v1/)       ← Viktor vidi podatke
P2  Webhooks (ADR-028 events)                   ← Viktor push
P4  Audit (api_audit_log)                       ← uz P1
──  P3 sync escalation — NE POSTOJI
V4  Viktor Skill (partner, read-only)
V5  Config/playbook proposals (operator:propose)
```

**Gate:** P1 ne počinje dok P0 testovi + `pnpm eval:denis` waiter parity nisu zeleni.

---

## Pravilo (svaki agent)

```
IMPLEMENTIRAJ kod u repou + testovi PASS.
❌ ZABRANJENO: Viktor u guest turn path (waitForCoachingResponse, inject-belief, escalate_to_viktor)
❌ ZABRANJENO: sve poruke → transactional_perceive
❌ ZABRANJENO: PATCH config direktno iz API-ja
❌ ZABRANJENO: /api/v2/ — koristi /api/operator/v1/
Ne commit-uj osim ako operator kaže.
```

---

# P0 — ADR-025 TDE (Denis standalone pametan)

```
## ZADATAK

Senior engineer. Implementiraj ADR-025 state-driven routing u decideTurnPlan — NE "LLM-first sve transactional".

## PROBLEM (potvrđeno u kodu)

decideTurnPlan koristio isCasualSocialGuestMessage → planForBanter (banter.welcome, requiresLlm: false).
"Može", "Daj mi sok", "Zdravo legendo" → template umesto LLM.

## ISPRAVNA LOGIKA (ADR-025 + ADR-023)

Posle early exit-a (T0, pending_slot, goal templates, committedFacts):

| Uslov | Plan | LLM |
|-------|------|-----|
| T0 / handoff | reflex_only | ❌ |
| settling | template_tell settle.thanks | ❌ |
| vague recommend | relational_perceive | ✅ |
| conversation.mode ordering / open commerce | transactional_perceive | ✅ |
| banter / free text default | relational_perceive | ✅ |

NE: everything → transactional_perceive
NE: planForBanter() kao default guest reply

## T0 REFLEX (reflex-rules.ts + reflex-plan.ts)

- Global T0: da, ja, yes, ok, potvrdi, confirm, …
- Kontekstualni T0 SAMO kad awaitingConfirm (recap | submit | collect+cart):
  može, moze, važi, ajde, naravno, klar, gerne, …
- NE dodavati može/ajde globalno

## compile-beliefs.ts

Reorder: hasOpenCommerce → ordering PRE casual banter klasifikacije.

## FAJLOVI

- src/lib/denis/cognition/tde/decide-turn-plan.ts
- src/lib/denis/cognition/beliefs/compile-beliefs.ts
- src/lib/denis/kernel/reflex-rules.ts
- src/lib/denis/kernel/reflex-plan.ts
- src/__tests__/denis-tde.test.ts

## TESTOVI (mora PASS)

- "Može" @ recap → T0 CONFIRM, reflex_only
- "Može" bez konteksta → relational_perceive (ne T0 global)
- "Daj mi sok" + ordering belief → transactional_perceive
- "Zdravo Denise legendo" → relational_perceive (NE banter.welcome)
- "da" → T0 reflex_only
- "hvala" / settling → template_tell

## NE DIRAJ

- Flow engine, ACT/ACL, fiscal, migrations on remote
- Template fallback kad LLM down (ostaje)

## GATE

pnpm test:run src/__tests__/denis-tde.test.ts
pnpm type-check && pnpm lint && pnpm build
```

---

# P1 — Operator API read (Viktor data feed)

```
## ZADATAK

Implementiraj Denis Operator API v1 — READ ONLY — da eksterni operator AI (Viktor) vidi stanje bez pristupa Supabase.

## ARHITEKTURA (ADR-028)

Denis = TRUTH. Viktor = čita preko HTTPS. Guest path NETAKNUT.

Base path: /api/operator/v1/
Auth: Authorization: Bearer dns_op_live_{token}
Scope: operator:read (NOVO — dodaj pored postojećih V1 scopes u src/lib/api/v1/scopes.ts ILI novi src/lib/operator/scopes.ts)
Org-bound: svaki key vezán za org_id

## ANALIZIRAJ POSTOJEĆE

- src/lib/api/v1/auth.ts — pattern qr_live_* keys
- src/app/api/v1/sessions/route.ts — sessions read pattern
- src/lib/ai/intelligence-service.ts — insights
- src/lib/webhooks/dispatch.ts — ne mešaj sa operator auth

## ENDPOINTS (P1 scope — READ ONLY)

1. GET /api/operator/v1/locations
   - Lista lokacija org-a (id, name, denisEnabled)

2. GET /api/operator/v1/locations/[locationId]/summary
   - Query: period=today|yesterday|7d
   - Rollup: orders (count, revenueCents), denis (sessions, conversionRate, llmInvocationRate), ops (rush, openWaiterCalls)
   - Shape: LocationSummary iz ADR-028 §4.4

3. GET /api/operator/v1/locations/[locationId]/denis/metrics
   - Detaljnije Denis KPI za Viktor dashboards

4. GET /api/operator/v1/sessions
   - Query: locationId, from, to, converted=true|false
   - Lista: id, status, createdAt, messageCount, language, converted

5. GET /api/operator/v1/sessions/[sessionId]/summary
   - Redacted transcript summary (turn count, intents, outcome)
   - Query ?include=transcript samo sa audit flag — default OFF
   - NIKAD: session_token, device fingerprint

## IMPLEMENTACIJA

- src/lib/operator/auth.ts
- src/lib/operator/audit-log.ts — log svaki request
- src/lib/operator/build-location-summary.ts
- src/lib/operator/build-session-summary.ts
- src/app/api/operator/v1/**/route.ts

## MIGRACIJA (nova, sequential)

- operator_api_keys (ili proširi api_keys sa operator scopes)
- operator_api_audit
- RLS org-scoped

## ZABRANJENO U P1

- PATCH/PUT config
- PUT playbook direktno
- POST coaching/respond
- inject-belief
- /api/v2/ prefix

## TESTOVI

src/__tests__/operator-api.test.ts — auth, scope, summary shape, GDPR redaction

## GATE

pnpm test:run src/__tests__/operator-api.test.ts
pnpm type-check && pnpm build
```

---

# P2 — Webhooks (Denis → Viktor async)

```
## ZADATAK

Proširi webhook sistem da Viktor dobija async evente o Denis operativi.

## PRAVILO

Isti dispatch pattern (src/lib/webhooks/dispatch.ts). HMAC. Auto-disable after failures.
Emit iz JEDNOG mesta — prefer outbox handler, ne dupli fire-and-forget.

## POSTOJEĆI EVENTI (zadrži)

order.created, order.paid, order.status_changed, order.cancelled, order.refunded,
session.opened, session.closed

## NOVI EVENTI (ADR-028 §5.2)

denis.session.completed       — outcome: ordered | abandoned | handoff
denis.session.converted       — first order in session
denis.metrics.daily_ready     — cron rollup (Viktor batch)
denis.alert.conversion_drop   — WoW threshold
denis.alert.credit_low
denis.alert.circuit_open
denis.learning.edge_candidate — optional, ako learned edge queue

Payload minimum:
{ orgId, locationId, sessionId?, metrics?, traceId, created_at }
Bez guest PII po defaultu.

## GDE DISPATCH

- Session close / expire → denis.session.completed
- First order submit in session → denis.session.converted
- Daily intelligence cron → denis.metrics.daily_ready
- Conversion monitor job → denis.alert.conversion_drop

## NE DODAVAJ

- denis.escalation.requested (sync escalation ne postoji)
- Blocking guest turn waiting for webhook response

## TESTOVI

Proširi src/__tests__/outbox.test.ts ili novi webhook-events.test.ts

## GATE

pnpm test:run + type-check + build
```

---

# P4 — Audit & observability (uz P1)

```
## ZADATAK

Audit logging za Operator API — Viktor integracija mora biti traceable.

## MIGRACIJA

operator_api_audit (ako nije u P1):
- api_key_id, org_id, endpoint, method, status_code
- request_summary jsonb (bez secrets)
- latency_ms, created_at
- RLS: org owner read

config_change_log (priprema za V5 proposals):
- org_id, location_id, changed_by ('admin'|'owner'|'operator_proposal')
- config_path, old_value, new_value, reason, created_at

## MIDDLEWARE

Wrapper za /api/operator/v1/* routes:
- measure latency
- log audit row
- never log: raw API key, session_token, fingerprint

## RETENTION

Document 90d audit in migration comment or cron cleanup job stub.

## NE KREIRAJ

escalation_log — sync escalation ne postoji

## GATE

operator-api tests + migration applies locally
```

---

# V5 — Proposals only (kasnije, ne P1)

```
## ZADATAK (SAMO posle P1+P2+V4 read-only Viktor pilot)

Write path = PROPOSAL, ne direct mutate.

POST /api/operator/v1/config/proposals
  Body: { locationId, patch: PartialConciergeConfig, reason }
  → status: pending → owner approves in admin → apply + config_change_log

POST /api/operator/v1/playbook/proposals
  Body: { locationId, examples: [...] }
  → admin review → approve → ai_examples insert + cache invalidate

Scope: operator:propose (odvojeno od operator:read)

ZABRANJENO: PATCH /config direktno, inject-belief, guest path changes
```

---

## Session report template

```markdown
## Viktor×Denis [P0/P1/P2/P4] — DONE

Files:
Tests: PASS/FAIL
Guest path grep: zero escalate_to_viktor / waitForCoachingResponse
Operator routes: /api/operator/v1/...

Next: [track]
```

---

## Brza provera (review agent)

```bash
# Viktor nikad u guest path
grep -rn "escalate_to_viktor\|waitForCoaching\|inject-belief\|injectBelief" src/

# Operator prefix
grep -rn "api/operator/v1" src/app/api/

# Nema v2 operator
grep -rn "api/v2/coaching" src/
```

Očekivano: prazno za escalation; operator v1 postoji.

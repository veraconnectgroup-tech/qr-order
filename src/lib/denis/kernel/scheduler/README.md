# L2 — Anticipation Scheduler (M8)

**Track:** M8 ✅  
**ADR:** [ADR-004 §9](../../../docs/architecture/ADR-004-denis-kernel.md)

- `build-schedules.ts` — pure schedule drafts from orders + config
- `evaluate-proactive.ts` — T1 template evaluation (no LLM)
- `schedule-store.ts` — Postgres `denis_schedules` + claim RPC

Cron: `GET /api/cron/denis-scheduler` (Bearer `CRON_SECRET`)

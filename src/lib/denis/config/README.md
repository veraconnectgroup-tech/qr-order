# M1 — ConciergeConfig ✅

**Track:** M1 (done)  
**ADR:** [ADR-002 §7](../../../docs/architecture/ADR-002-ai-concierge-orchestrator.md)

- `concierge-config.schema.ts` — Zod v1 schema
- `concierge-defaults.ts` — platform defaults + cache keys
- `merge-concierge-config.ts` — org → location deep merge
- `config-cache.ts` — Redis `ai:config:{locationId}`
- `load-concierge-config.ts` — DB load + cache
- `rollout-cutover.ts` — ops ladder presets (M25 admin UI)

Migration: `00086_ai_concierge_config.sql`

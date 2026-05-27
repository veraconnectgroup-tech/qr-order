# Runtime — Narrate (M9)

**Track:** M9 ✅  
**ADR:** [ADR-004 §11](../../../docs/architecture/ADR-004-denis-kernel.md)

- `build-narration-facts.ts` — facts bundle from plan + cart + config
- `lint-narration.ts` — post-check T3 (forbidden, unallowed products, submit claims)
- `template-fallback.ts` — safe template when lint fails

Only layer allowed to import OpenAI client (future `narrate-llm.ts`).

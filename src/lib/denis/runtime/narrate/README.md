# Runtime — Narrate (M9)

**Tracks:** M9 ✅ · M21 narrate-llm ✅  
**ADR:** [ADR-004 §11](../../../docs/architecture/ADR-004-denis-kernel.md)

- `build-narration-facts.ts` — facts bundle from plan + cart + config
- `lint-narration.ts` — post-check T3 (forbidden, unallowed products, submit claims)
- `template-fallback.ts` — safe template when lint fails

- `narrate-llm.ts` — facts-only T3 when `llm.narrateWithLlm` + rollout `denis_only`
- `resolve-turn-narration.ts` — legacy vs Denis narrator vs template

Only layer allowed to import OpenAI client (`narrate-llm.ts`).

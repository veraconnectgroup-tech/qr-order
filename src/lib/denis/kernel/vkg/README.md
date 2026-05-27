# L2 — VKG (M5)

**Track:** M5 ✅  
**ADR:** [ADR-004 §5](../../../docs/architecture/ADR-004-denis-kernel.md)

- `build-graph.ts` — L0 catalog + L1 `upsell_rules` → `pairs_with` edges
- `queries.ts` — `pairingFor`, `safeForAllergies`, `substituteFor`, `explainProduct`
- `load-graph.ts` — DB load + Redis cache `ai:vkg:{locationId}`

No LLM in VKG queries — narration receives facts only (T3).

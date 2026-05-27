# L2 — Conflict Resolver (M6)

**Track:** M6 ✅  
**ADR:** [ADR-004 §6](../../../docs/architecture/ADR-004-denis-kernel.md)

- `detect.ts` — AI draft vs manual cart diff
- `resolve.ts` — strategy + unified view + guest prompt
- `prompts.ts` — one-shot Serbian templates for T3

Never silently merge. `RECONCILE_CART` goal when `hasConflict`.

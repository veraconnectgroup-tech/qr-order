# L2 — Kernel

**Tracks:** M3 ✅, M4 ✅, M5 ✅, M6 ✅, M8  
**ADR:** [ADR-004 §7](../../../docs/architecture/ADR-004-denis-kernel.md)

- `reflex-rules.ts` — T0 confirm/decline/done/corrections (no LLM)
- `correction-protocol.ts` — remove, add_more, undo (max depth 5)
- `reflex-plan.ts` — `planTurnWithReflex()` wires T0 + conflict before flow plan
- `cart-projection.ts` — kernel cart + undo stack
- `conflict/` — AI vs manual cart resolver (M6)
- `vkg/` — venue knowledge graph (M5)

**May import:** config, platform only.

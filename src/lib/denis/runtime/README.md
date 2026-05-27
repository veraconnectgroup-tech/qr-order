# Runtime — PPAN+

**Track:** M7  
**ADR:** [ADR-003 §2](../../../docs/architecture/ADR-003-denis-platform-v2.md), [ADR-004 §10](../../../docs/architecture/ADR-004-denis-kernel.md)

- `runDenisTurn()` — perceive → plan → act → narrate
- Only layer that orchestrates cross-layer calls

**OpenAI allowed only in:** `runtime/narrate/`, `runtime/perceive/`

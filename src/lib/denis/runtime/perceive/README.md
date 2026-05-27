# Runtime — Perceive (M22)

**Track:** M22 ✅  
**ADR:** [ADR-003 §7](../../../docs/architecture/ADR-003-denis-platform-v2.md)

- `heuristic-slot-extract.ts` — T0-heavy multi-item parse (no LLM)
- `slot-extract-llm.ts` — optional T2 when `llm.slotExtractWithLlm`
- `slot-extract.ts` — orchestrator

Wired in `runDenisTurn` as timeline/shadow signal only — legacy `execute-chat-turn` still owns cart until act/ACL.

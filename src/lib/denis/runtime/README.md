# Runtime — PPAN+

**Tracks:** M7 ✅, M8 ✅, M9 ✅, M10 ✅ (shadow)  
**ADR:** [ADR-003 §2](../../../docs/architecture/ADR-003-denis-platform-v2.md)

| Module | Role |
|--------|------|
| `run-denis-turn.ts` | Main chat entry — plan → legacy LLM → lint → timeline |
| `run-denis-sense.ts` | Sensory ingest without chat |
| `process-scheduler-tick.ts` | Cron anticipation worker |
| `persist-turn-timeline.ts` | Append-only timeline writes |
| `build-turn-context.ts` | Config, flow fold, cart projections |
| `narrate/` | T3 facts + lint + template fallback |
| `shadow-diff.ts` | Legacy vs kernel parity (shadow mode) |
| `record-chat-turn-timeline.ts` | Deprecated — use `runDenisTurn` |

**Not yet:** `perceive/slot-extract.ts`, `act/*`, `narrate/narrate-llm.ts`

**OpenAI today:** legacy `src/lib/ai/execute-chat-turn.ts` only.

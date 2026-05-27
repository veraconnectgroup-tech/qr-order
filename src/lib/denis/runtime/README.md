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
| `ga-gate.ts` | ADR-010 rollout promotion checks (admin UI) |
| `turn-observability.ts` | Structured `denis.turn.completed` logs + phase timings |

**F8:** Legacy adapter slim (F8-2+) — see [ADR-010](../../../docs/architecture/ADR-010-denis-ordering-cutover.md).

**M22:** `perceive/slot-extract.ts` (opt-in timeline signal)  
**M23:** `act/*` + `acl/DenisOrderCommand` (dry-run default)

**OpenAI today:** legacy `src/lib/ai/execute-chat-turn.ts` only.

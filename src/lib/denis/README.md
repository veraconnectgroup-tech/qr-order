# Denis Maximum — Code Layout

North star: [`docs/architecture/ADR-005-denis-maximum.md`](../../../docs/architecture/ADR-005-denis-maximum.md)  
Operational map (as-built **M0–M10**): [`docs/architecture/denis-implementation-map.md`](../../../docs/architecture/denis-implementation-map.md)

## Layers (May 2026)

```
src/lib/denis/
├── architecture/   compliance engine (pnpm verify:denis)
├── config/         M1 ✅ ConciergeConfig + M10 rollout
├── platform/       M2 ✅ timeline, M3 flow, M8 sense-types
├── kernel/         M3–M6, M8 ✅ goals, VKG, conflict, scheduler
├── venue/          M12+ stub
├── runtime/        M7–M10 ✅ runDenisTurn, sense, narrate lint, shadow-diff
├── surfaces/       M7 ✅ chat formatters
├── acl/            stub — Order Core cutover pending
├── learning/       M16+ stub
└── eval/           M10 ✅ fixtures + pnpm eval:denis
```

## Entry points

| API | Runtime function |
|-----|------------------|
| `POST /api/ai/chat` | `runDenisTurn` (via thin `chat-service.ts`) |
| `POST /api/denis/turn` | `runDenisTurn` |
| `POST /api/denis/sense` | `runDenisSense` |

## Rules

1. **New Denis logic lives here** — not in `execute-chat-turn.ts` except transitional LLM/ordering.
2. **`pnpm verify:denis`** + **`pnpm eval:denis`** before every Denis PR.
3. **One M-track per PR** — see map §7.

## Legacy

| File | Role |
|------|------|
| `src/lib/ai/execute-chat-turn.ts` | OpenAI + ordering + session (until narrate/act cutover) |
| `src/lib/ai/chat-service.ts` | 11-line wrapper → `runDenisTurn` |

# Denis Maximum — Code Layout

North star: [`docs/architecture/ADR-005-denis-maximum.md`](../../../docs/architecture/ADR-005-denis-maximum.md)  
Operational map: [`docs/architecture/denis-implementation-map.md`](../../../docs/architecture/denis-implementation-map.md)

## Layers

```
src/lib/denis/
├── architecture/   Compliance rules (import matrix)
├── config/         M1 — ConciergeConfig
├── platform/       M2 — timeline, fold, Flow DSL
├── kernel/         M3–M6 — beliefs, goals, VKG, conflict
├── venue/          M12+ — floor graph, party, staff copilot
├── runtime/        M7 — runDenisTurn (PPAN+)
├── surfaces/       M7 — chat, nudge formatters
├── acl/            Order Core boundary
├── learning/       M16+ — learned edges, guest memory
└── eval/           M10 — regression harness
```

## Rules

1. **New Denis code lives here** — not in bloated `src/lib/ai/chat-service.ts`.
2. **Run `pnpm verify:denis`** before every Denis PR.
3. **One M-track per PR** — see implementation map §6.

Legacy `src/lib/ai/` is transitional until M7 cutover.

# L1 — Platform

**Tracks:** M2 ✅, M8  
**ADR:** [ADR-003 §3](../../../docs/architecture/ADR-003-denis-platform-v2.md) · [ADR-006 traceId](../../../docs/architecture/ADR-006-denis-control-plane.md)

- `timeline-types.ts` — event types + `TurnEnvelope`
- `append-timeline-event.ts` — RPC append + load
- `risk-levels.ts` — R0–R5 (ADR-006)
- `flows/*.flow.json` — Flow DSL presets

**Must not import:** kernel, venue, runtime, surfaces, acl, learning, eval.

Dual-write bridge lives in `runtime/record-chat-turn-timeline.ts`.

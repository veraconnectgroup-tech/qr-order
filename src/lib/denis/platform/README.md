# L1 — Platform

**Tracks:** M2, M8  
**ADR:** [ADR-003 §3](../../../docs/architecture/ADR-003-denis-platform-v2.md)

- `denis_timeline` append-only events
- `fold-projections.ts`, `replay.ts`
- `flows/*.flow.json` — Flow DSL presets

**Must not import:** kernel, venue, runtime, surfaces, acl, learning, eval.

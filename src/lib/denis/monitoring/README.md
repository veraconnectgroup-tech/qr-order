# Denis self-monitoring (Layer 6 S1)

**Track:** Layer 6 S1 — Denis Health Dashboard  
**ADR:** [ADR-019 Phase S](../../../docs/architecture/ADR-019-denis-unified-brain.md)

- `denis-health.ts` — live health evaluation + auto-actions (no LLM)
- `health-metrics-store.ts` — Redis rolling turn samples per location
- `health-state.ts` — degraded/critical state transitions + gradual recovery
- `loop-detection.ts` — per-session conversation loop detection + recovery (S2)
- `loop-recovery-store.ts` — Redis recovery attempt counter per session

**May import:** config, platform.

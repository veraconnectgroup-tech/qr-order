# Live A/B experiments (M1)

**Track:** Layer 4 M1  
**ADR:** [ADR-019 Phase M](../../../docs/architecture/ADR-019-denis-unified-brain.md)

- `live-ab.ts` — deterministic variant assignment + statistical evaluation
- `apply-live-ab-config.ts` — merge active experiment variant onto ConciergeConfig
- `record-session-metrics.ts` — persist session outcomes for running experiments

Offline counterfactual replay remains in `eval/run-venue-sim.ts` (M20).

**May import:** config only.

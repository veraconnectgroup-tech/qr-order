# Denis ingress — ADR-019 Phase C

Guest write path normalization: `POST /api/denis/signal` → `normalizeDenisSignal` → runtime loop.

| File | Role |
|------|------|
| `signal-types.ts` | Zod + TypeScript for `DenisSignal` |
| `normalize-signal.ts` | Validate + map to turn / sense / handoff routes |

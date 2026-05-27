# Eval & shadow mode

**Track:** M10 ✅  
**ADR:** [ADR-005 §7.3](../../../docs/architecture/ADR-005-denis-maximum.md), [ADR-006 §5–6](../../../docs/architecture/ADR-006-denis-control-plane.md)

- `fixtures/scenarios.ts` — golden kernel scenarios
- `run-scenario.ts` / `run-fixtures.ts` — CI harness
- `assert-risk.ts` — R5 boundary checks
- Shadow diff lives in `runtime/shadow-diff.ts` (import matrix)

```bash
pnpm eval:denis
```

**May import:** config, platform, kernel, runtime (read-only fold).

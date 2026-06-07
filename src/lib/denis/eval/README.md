# Eval & shadow mode

**Tracks:** M10 ✅ · M20 venue sim ✅ · M24 eval run history ✅  
**ADR:** [ADR-005 §7.3](../../../docs/architecture/ADR-005-denis-maximum.md), [ADR-006 §5–6](../../../docs/architecture/ADR-006-denis-control-plane.md)

- `fixtures/scenarios.ts` — golden kernel scenarios
- `fixtures/timeline/iota-obligation-scenarios.ts` — iota timeline obligation replay (ADR-032 P1-T7)
- `run-scenario.ts` / `run-fixtures.ts` — CI harness
- `run-venue-sim.ts` — counterfactual timeline replay (M20)
- `persist-eval-run.ts` — append suite to `denis_eval_runs` (M24)
- `record-eval-suite.ts` — run + optional persist (M26 CI/script)
- `assert-risk.ts` — R5 boundary checks
- Shadow diff lives in `runtime/shadow-diff.ts` (import matrix)

```bash
pnpm eval:denis
pnpm eval:denis:record   # run suite + persist (needs Supabase env)
```

Platform UI: `/platform/denis-eval` + `/platform/denis-eval/[runId]` (migration `00093`).

CI (`.github/workflows/ci.yml`): `pnpm verify:denis`, `pnpm eval:denis`; on `main` push with Supabase secrets → `pnpm eval:denis:record`.

**May import:** config, platform, kernel, runtime (read-only fold).

# Contributing to Denis

Quick onboarding for developers working on the Denis Table OS stack.

## Quick Start

```bash
pnpm install && pnpm dev:setup
```

Open `http://localhost:3000/skyline-lounge/demo-table-8` (or your seeded QR URL), chat with Denis, place a test order.

## Adding a Feature

### 1. Read the architecture

- [DENIS-ARCHITECTURE-START-HERE.md](./architecture/DENIS-ARCHITECTURE-START-HERE.md)
- [`src/lib/denis/README.md`](../src/lib/denis/README.md) — layer map
- [denis-implementation-map.md](./architecture/denis-implementation-map.md) — as-built status

### 2. Find the right layer

| Change type | Path |
|-------------|------|
| Cognition / beliefs / perceive | `src/lib/denis/cognition/` |
| Runtime loop / turns | `src/lib/denis/runtime/` + `loop/` |
| Config / rollout | `src/lib/denis/config/` |
| Eval fixtures | `src/lib/denis/eval/` |
| Guest UI | `src/components/guest/` |
| Dashboard / admin | `src/components/dashboard/` / `admin/` |

### 3. Write code

- Follow the layer import matrix — enforced by `pnpm verify:denis`
- Types first, implementation second
- No `as unknown as` — use typed Supabase queries
- One PR = one ADR-019 phase step when touching Denis spine

### 4. Test

```bash
pnpm type-check
pnpm verify:denis
pnpm verify:layer12
pnpm test:run
pnpm eval:denis
pnpm eval:gate
pnpm perf:check
```

For guest accessibility changes, also run `pnpm test:e2e:a11y` (requires `pnpm build` first).

For prompt or planner changes, also run `pnpm eval:gate` before opening PR.

### 5. PR checklist

- [ ] `pnpm verify:denis` passes
- [ ] `pnpm verify:layer12` passes (docs, i18n, a11y, ops)
- [ ] `pnpm eval:denis` passes
- [ ] `pnpm eval:gate` passes (if eval fixtures or thresholds changed)
- [ ] New behaviour has eval fixture or unit test
- [ ] Module README updated if you added a new folder
- [ ] ADR if architectural decision

## Common Mistakes

**Adding logic directly to `run-denis-turn.ts`**  
→ Put it in the appropriate phase file under `runtime/` or `cognition/`.

**`as unknown as` to silence types**  
→ Fix the Supabase row type or add a narrow mapper.

**Testing with `console.log`**  
→ Use `logger.info()` with structured metadata.

**Sequential awaits for independent IO**  
→ Use `Promise.all()`.

**Cross-layer imports**  
→ Check `DENIS_IMPORT_MATRIX` in architecture compliance test.

## API & Docs

- OpenAPI spec: `/api/docs` (dev or staff auth)
- Ops runbook: [docs/runbooks/DENIS-OPS.md](./runbooks/DENIS-OPS.md)

## Deeper docs

Full ADR index: [ARCHITECTURE-INDEX.md](./architecture/ARCHITECTURE-INDEX.md)

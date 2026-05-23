# k6 load tests

Load test suite for the QR Order guest flow, Stripe webhooks, and SSE order tracking.

## Prerequisites

Install [k6](https://k6.io/) (not an npm dependency):

```bash
brew install k6
```

Start the app with seed data applied (`pnpm db:reset` or remote DB with `00004_seed.sql`):

```bash
pnpm dev
# or
pnpm build && pnpm start
```

## Run tests

Scripts auto-detect the dev server on ports **3000 → 3001 → 3002** (via `/api/health`). Override with `BASE_URL` if needed.

```bash
pnpm test:load:smoke   # 5 VUs, 30s — use this on localhost first
pnpm test:load         # 50 VUs, 2m — staging / production-like targets
pnpm test:load:burst
pnpm test:load:sse
```

For local load tests, start the dev server with rate limits disabled on guest endpoints:

```bash
LOAD_TEST=true pnpm dev
```

Then in another terminal:

```bash
pnpm test:load:smoke
```

Do **not** append shell comments on the same line (`# ...`) — zsh passes them as extra k6 arguments.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | auto (3000→3001→3002) | Target server |
| `TEST_SLUG` | `skyline-lounge` | Org slug from seed data |
| `TEST_TOKEN` | `demo-table-1` | Table QR token from seed data |
| `TEST_PRODUCT_ID` | `f0000000-…000001` | Aperol Spritz product id |

Example against staging:

```bash
BASE_URL=https://your-app.vercel.app TEST_TOKEN=demo-table-1 pnpm test:load
```

## Notes

- **guest-flow** — landing → health → menu → session → create order → SSE (5 s read).
- **webhook-burst** — sends mock Stripe payloads without a valid signature; expects `400` (not `5xx`). Use real `STRIPE_WEBHOOK_SECRET` only if you wire signed fixtures.
- **sse-connections** — each VU creates a fresh order, then holds an SSE connection for 30 s.
- VUs rotate across seed table tokens so sessions are not all pinned to one table.
- High VU counts against `localhost` still stress `next dev` — expect threshold failures unless you use staging or `pnpm start`.
- Rate limits (`orders`, `sessions`) apply per IP; all k6 VUs share `127.0.0.1`. Use `LOAD_TEST=true pnpm dev` locally or test against staging with Redis configured.

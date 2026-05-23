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

```bash
pnpm test:load          # guest flow — 50 VU, 2 min
pnpm test:load:burst    # Stripe webhook burst — 100 VU, 30 s
pnpm test:load:sse      # SSE connections — ramp 10→100 VU, 3 min
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:3000` | Target server |
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
- High VU counts against `localhost` may hit rate limits (`orders`, `sessions` scopes). Increase limits or test against a staging environment with Redis rate limiting configured.

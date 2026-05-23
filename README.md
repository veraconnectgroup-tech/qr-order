# QR Order

Enterprise QR-based ordering and payments for hospitality venues. Guests scan a table QR code to browse the menu, order, and pay — no app install, no registration.

**Live demo:** [skyline-lounge/demo-table-8](https://qr-order-iota.vercel.app/skyline-lounge/demo-table-8)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind 4, shadcn/ui |
| Backend | Next.js API routes, Supabase (PostgreSQL + Auth + Realtime + Storage) |
| Payments | Stripe Connect |
| State | Zustand (cart, guest session) |
| Monitoring | Sentry, `/api/health` |
| Hosting | Vercel |

---

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Supabase project

1. Create a project at [supabase.com](https://supabase.com)
2. Run `supabase/cloud-setup.sql` in the SQL Editor (first time), or `supabase/incremental-updates.sql` for existing DBs
3. Enable Realtime on `orders` and `waiter_calls`

### 3. Environment variables

```bash
cp .env.example .env.local
```

Minimum for local dev:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

See [`.env.example`](.env.example) for the full list (Stripe, Sentry, Upstash, fiskaly, VAPID, Resend).

### 4. Run

```bash
pnpm dev
```

| URL | Purpose |
|-----|---------|
| http://localhost:3000 | Landing page |
| http://localhost:3000/skyline-lounge/demo-table-8 | Live demo menu |
| http://localhost:3000/signup | Owner registration |

---

## Architecture

```
┌─────────────┐     QR scan      ┌──────────────────┐
│  Guest PWA  │ ◄──────────────► │  Next.js API     │
│  (no auth)  │                  │  + Supabase SR   │
└─────────────┘                  └────────┬─────────┘
                                          │
┌─────────────┐                           │
│  Dashboard  │ ◄── staff auth ──────────┤
│  (waiters)  │     Supabase Realtime     │
└─────────────┘                           │
                                          │
┌─────────────┐                           │
│    Admin    │ ◄── owner auth ───────────┤
│  (menu/QR)  │                           │
└─────────────┘                           │
                                          ▼
                                 ┌─────────────────┐
                                 │  PostgreSQL     │
                                 │  Stripe Connect │
                                 │  fiskaly TSE    │
                                 └─────────────────┘
```

### Route groups

| Group | Path | Auth |
|-------|------|------|
| `(guest)` | `/[slug]/[token]/*` | None — table QR token |
| `(dashboard)` | `/dashboard/*` | Staff session |
| `(admin)` | `/admin/*` | Owner / manager |
| `(platform)` | `/platform/*` | Platform admin |
| `(auth)` | `/login`, `/signup` | Public |

### Key conventions

- Price snapshots in `order_items` at order time — never live prices
- Daily order numbers via `get_next_order_number()` PostgreSQL function
- QR URLs use `qr_token`, not table ID
- Stripe Connect account on `organizations`, not locations
- Amounts as DECIMAL in DB; cents only for Stripe API

---

## Deployment (Vercel)

1. **Import repo** to Vercel and set framework preset to Next.js
2. **Environment variables** — copy all vars from `.env.example` into Vercel project settings (Production + Preview)
3. **Required for production:**
   - All Supabase keys
   - `NEXT_PUBLIC_APP_URL` → your production domain
   - Stripe keys + webhook endpoint
   - `UPSTASH_REDIS_*` for rate limiting
   - `NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_AUTH_TOKEN` for error monitoring
4. **Stripe webhook** — point to `https://YOUR-DOMAIN/api/stripe/webhook`, copy signing secret to `STRIPE_WEBHOOK_SECRET`
5. **Supabase migrations** — `supabase link && supabase db push` or run SQL manually
6. **Cron jobs** — configured in `vercel.json` (`/api/cron/cleanup`, `/api/health/deep`)

```bash
pnpm build   # verify locally before deploy
```

---

## Rate Limiting

Production limits (per IP unless noted). Requires Upstash Redis; in-memory fallback for local dev.

| Scope | Limit | Routes |
|-------|-------|--------|
| `orders` | 10/min | POST `/api/orders`, checkout, split |
| `waiter-calls` | 3/min | POST `/api/waiter-calls` |
| `ai` | 20/min | `/api/ai/chat`, conversion, session |
| `bill` | 5/min | `/api/sessions/bill` |
| `push` | 10/min | `/api/push/subscribe` |
| `feedback` | 5/min | `/api/feedback` |
| `sessions` | 30/min | Table session creation |
| `payments` | 30/min | Stripe intents, refunds |
| `default` | 60/min | Everything else |

Set `LOAD_TEST=true` to bypass order/session limits during k6 tests.

---

## Security

- **Headers** (middleware): HSTS, CSP, `X-Frame-Options: DENY`, `nosniff`, Permissions-Policy
- **API validation**: Zod schemas on all guest-facing routes (`src/lib/security/zod-fields.ts`)
- **Stripe webhook**: Signature verified via `stripe.webhooks.constructEvent()`
- **Service role key**: Server-only — never exposed to client
- **RLS**: Supabase row-level security on all tenant tables

---

## Monitoring

```text
GET /api/health          → public uptime check (200 = healthy/degraded)
GET /api/health/deep     → DB write probe (requires Authorization: Bearer CRON_SECRET)
```

Sentry captures client, server, and edge errors when `NEXT_PUBLIC_SENTRY_DSN` is set.

---

## Scripts

```bash
pnpm dev              # Development server
pnpm build            # Production build
pnpm lint             # ESLint
pnpm test:e2e         # Playwright guest flow
pnpm test:load        # k6 load test
pnpm db:types:remote  # Regenerate Supabase TypeScript types
```

---

## Project Structure

```
src/
├── app/
│   ├── (guest)/          # Guest ordering flow
│   ├── (dashboard)/      # Staff dashboard + kitchen
│   ├── (admin)/          # Owner admin panel
│   ├── (platform)/       # Platform super-admin
│   ├── (auth)/           # Login / signup
│   └── api/              # REST API + webhooks
├── components/           # UI components by domain
├── lib/                  # Business logic, integrations
└── hooks/                # Zustand stores, React hooks
supabase/
├── migrations/           # Sequential SQL migrations
└── cloud-setup.sql       # Full schema + seed for new projects
```

---

Made in Germany · KassenSichV · DATEV · Stripe Connect

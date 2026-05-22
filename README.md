# QR Order

QR-based ordering and payment platform for hospitality venues. Guests scan a QR code at their table to browse the menu, order, and pay — no app install, no registration.

## Tech Stack

- **Next.js 16** (App Router, TypeScript, RSC)
- **Tailwind CSS 4** + shadcn/ui
- **Supabase** (PostgreSQL, Auth, Realtime, Storage) — **cloud, bez Docker-a**
- **Stripe Connect** (payments)
- **Zustand** (cart + guest session)
- **Vercel** (hosting)

---

## Brzi start (bez Docker Desktop-a)

Docker ti **nije potreban**. Koristi besplatan Supabase projekat u oblaku.

### 1. Instaliraj zavisnosti

```bash
pnpm install
```

### 2. Kreiraj Supabase projekat

1. Idi na [supabase.com](https://supabase.com) → **New project**
2. Sačekaj da se projekat pokrene (~2 min)

### 3. Pokreni bazu (SQL Editor)

1. U Supabase Dashboard → **SQL Editor** → **New query**
2. Otvori fajl `supabase/cloud-setup.sql` iz ovog projekta
3. Kopiraj **ceo** sadržaj → **Run**

To kreira tabele, RLS politike, realtime i demo podatke (Skyline Lounge).

### 4. Uključi Realtime (ako već nije)

Dashboard → **Database** → **Publications** → proveri da su `orders` i `waiter_calls` u `supabase_realtime`.

Ili u SQL Editoru:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE waiter_calls;
```

### 5. Env varijable

Dashboard → **Project Settings** → **API** — kopiraj URL i ključeve.

```bash
cp .env.local.example .env.local
```

U `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://TVOJ-PROJEKT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

NEXT_PUBLIC_APP_URL=http://localhost:3000

# Stripe (opciono za test plaćanja)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

> **Service role key** drži tajnim — samo na serveru, nikad u browseru.

### 6. Pokreni aplikaciju

```bash
pnpm dev
```

- Landing: [http://localhost:3000](http://localhost:3000)
- **Demo meni:** [http://localhost:3000/skyline-lounge/demo-table-8](http://localhost:3000/skyline-lounge/demo-table-8)
- Registracija admina: [http://localhost:3000/signup](http://localhost:3000/signup)

---

## Supabase CLI (opciono, i bez Docker-a)

Ako imaš Supabase CLI (`brew install supabase/tap/supabase`), možeš da gurneš migracije na cloud:

```bash
supabase login
supabase link --project-ref TVOJ-PROJECT-REF
supabase db push
pnpm db:types:remote   # generiše TypeScript tipove iz cloud baze
```

`project-ref` nađeš u URL-u: `https://supabase.com/dashboard/project/ovde-je-ref`

---

## Lokalni Supabase (samo ako imaš Docker)

```bash
pnpm db:start
pnpm db:reset
pnpm db:types
```

---

## Project Structure

| Route group | Purpose |
|-------------|---------|
| `(guest)` | Guest ordering — no auth |
| `(dashboard)` | Staff dashboard — auth required |
| `(admin)` | Admin panel — owner/manager only |
| `(auth)` | Login, signup, OAuth callback |

## Scripts

```bash
pnpm dev              # Dev server
pnpm build            # Production build
pnpm lint             # ESLint
pnpm db:types:remote  # Tipovi iz cloud Supabase projekta
```

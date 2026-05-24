# Supabase — hibridne migracije (baseline)

> **Status projekta `qr-order`:** remote baza je nastala iz `cloud-setup.sql`,  
> ali CLI migration history je **baseline-ovan** 2026-05-23.  
> Od `00064` nadalje: samo `supabase db push`.

---

## Dva izvora istine (istorijski)

| Izvor | Kada | Šta radi |
|-------|------|----------|
| `supabase/cloud-setup.sql` | Prvi setup projekta | Cela šema + seed u SQL Editoru |
| `supabase/incremental-updates.sql` | Ručne izmene | Patch SQL u dashboardu |
| `supabase/migrations/00001–00063.sql` | Repo (formalno) | Verzionisane migracije za CLI |

**Problem:** Remote **nije** nastao pokretanjem `00001.sql` → `00060.sql` kroz CLI.  
Zato `supabase db push` na prazan history pokušava da kreira tabele koje **već postoje**.

---

## Šta je urađeno (baseline)

Na projektu `mcumfksxujgtjfjfwtpl` (qr-order):

1. `supabase link --project-ref mcumfksxujgtjfjfwtpl`
2. `supabase migration repair --status applied` za **00001–00060** i **00033** (seed)
   - Ovo **NE izvršava SQL** — samo upisuje u `supabase_migrations.schema_migrations` da su “već primenjene”
3. `supabase db push --yes` — **stvarno izvršio SQL** samo za:
   - `00061_order_events_outbox.sql`
   - `00062_orders_idempotency_key.sql`
   - `00063_order_channel_deliveries.sql`

### Popravka duplog broja

- `00004_seed.sql` → preimenovan u **`00033_seed.sql`** (dupli `00004` sa `00004_security_audit.sql`)
- Seed označen kao applied **bez izvršavanja** (Skyline Lounge već postoji u bazi)

### Provera da je sve usklađeno

```bash
supabase migration list
```

Očekivano: **Local i Remote kolone iste** za 00001–00063.

---

## Šta to znači u praksi

### ✅ Bezbedno

```bash
# Nove migracije (00064+)
supabase db push --yes

# Provera stanja
supabase migration list
```

### ❌ Opasno — NE RADITI na remote qr-order

| Komanda | Zašto |
|---------|-------|
| `supabase db reset` (remote) | Brisanje produkcijskog/staging podataka |
| Ponovni push 00001 bez repair | `relation already exists` |
| `--include-all` na starim migracijama | Seed duplikat (`organizations_pkey`) |
| `pnpm db:types:remote` bez plana | Generiše 80+ nullable tipova, lomi build |

### ⚠️ Potencijalni drift

Teoretski, `cloud-setup.sql` + ručni patch-evi mogu **malo odstupati** od zbirnog sadržaja `00001–00060`.  
Do sada nije prijavljeno — app radi na toj bazi.

Ako `db push` za **novu** migraciju failuje sa “column already exists” ili slično:
- Schema već postoji ručno → `migration repair --status applied VERSION` **bez** push-a
- Ili napiši migraciju sa `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`

---

## Od sada — jedan workflow

```
1. Napiši supabase/migrations/00064_....sql
2. Test lokalno (Docker) ILI review SQL ručno
3. supabase db push --yes
4. Ručno dodaj tipove u src/types/database.ts (dok ne pređemo na auto-gen)
5. Commit migracija + tipova zajedno
```

**Jedan developer = jedan broj migracije.** Nikad dva `00064`.

---

## Tipovi (`database.ts`)

Repo koristi **ručno održavan** `src/types/database.ts` (stroži tipovi od Supabase gen).

Posle svake migracije dodaj samo nove tabele/kolone — **ne** `pnpm db:types:remote` dok ne odlučimo da migriramo ceo projekat na auto-generisane tipove.

ADR tabele već dodate ručno:
- `order_events`
- `outbox_events`
- `order_channel_deliveries`
- `orders.idempotency_key`

---

## Agent prompt (hibridno stanje)

Kopiraj u Cursor sesiju:

```
Supabase qr-order ima HIBRIDNI baseline:
- 00001–00060 su označene applied (repair), NE pokretaj ih ponovo
- 00061–00063 su stvarno push-ovane
- Nove migracije samo 00064+ preko supabase db push --yes
- NE db:reset na remote, NE db:types:remote
- Pročitaj docs/architecture/supabase-migration-baseline.md

Pre push-a: supabase migration list — proveri da nema conflict-a.
```

---

## Reference

- [ADR-001-implementation-warnings.md §4](./ADR-001-implementation-warnings.md) — redosled migracija
- [ADR-001-session-prompts.md §A2 baseline](./ADR-001-session-prompts.md) — repair komande

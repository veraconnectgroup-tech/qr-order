# ADR-001 — Safe rollout (ne diraj Supabase pogrešno)

> **Cilj:** enterprise arhitektura (outbox, idempotency, Redis PIN…)  
> **Ograničenje:** remote `qr-order` (`mcumfksxujgtjfjfwtpl`) već radi u produkciji/demo — **nema big-bang migracija, nema reset-a**.

---

## Zlatna pravila Supabase-a

| ✅ Uvek | ❌ Nikad |
|---------|----------|
| `supabase migration list` pre i posle push-a | `supabase db reset` na remote |
| Jedna migracija = jedan broj (`00064`, `00065`…) | Ponovni push `00001–00060` |
| `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` u novom SQL-u | Brisanje kolona/tabela bez ADR review-a |
| `supabase db push --yes` samo za **nove** fajlove | `pnpm db:types:remote` (lomi 80+ TS fajlova) |
| Ručno dodaj tipove u `src/types/database.ts` | Ručni SQL u dashboardu paralelno sa migracijama |
| Dual-write dok outbox nije verified (A3) | Uklanjanje `scheduleOrderTseSign` pre A3 |

---

## Trenutno stanje (bezbedno)

```
Remote schema:
  ✅ Postojeće tabele — NETAKNUTE (baseline repair, ne re-run)
  ✅ NOVO dodato SQL-om: order_events, outbox_events, orders.idempotency_key, order_channel_deliveries

App kod:
  ✅ A2 — upis u outbox + order_events (graceful ako tabele nedostaju)
  ✅ Legacy fire-and-forget i dalje radi (fallback)

Migration history:
  ✅ Local = Remote do 00063
```

**Zaključak:** do sada nismo dirali postojeće tabele — samo **dodali** nove. To je najbezbedniji obrazac i dalje ga držimo.

---

## Faze implementacije (Supabase-safe)

### Faza 0 — Gotovo ✅
- Baseline dokumentovan (`supabase-migration-baseline.md`)
- A1 migracije 61–63 push-ovane
- A2 outbox enqueue (additive, ne menja orders flow)

### Faza 1 — A3 Outbox processor ✅
**Šta dira Supabase:** `00064` — samo **dve PG funkcije** (`claim_outbox_events`, `complete_outbox_event`).  
**Ne dira:** postojeće tabele, RLS, orders flow.

**Gate pre A7/A8:** 1 test order → `outbox_events.status = done`.

### Faza 2 — A4 Idempotency (sledeće)
**Migracija:** već push-ovana (`00062`).  
**Kod:** samo logika u API — `INSERT` sa `idempotency_key`, duplicate → return existing.  
**Rizik:** nizak — kolona nullable, stari clienti rade bez headera.

### Faza 3 — A5 PIN Redis (zero DB schema)
**Supabase:** ništa. Samo Redis (Upstash već u projektu).  
**Rizik:** srednji operativno — test approve + refresh.

### Faza 4 — A6 Approve TX (opciono PG funkcija)
**Opcija A (bezbednija):** ostati na TS + postojeći Supabase client, samo bolji error handling.  
**Opcija B (kasnije):** `approve_order_access()` RPC — **nova migracija 00064**, ne dira postojeće.

Preporuka: **A prvo**, RPC tek kad A3–A5 stabilni.

### Faza 5 — A7/A8 Ukloni dual-write
**Tek posle** A3 verified u staging-u.  
Inače gubiš fallback ako outbox padne.

### Faza 6+ — Track C/D (POS, CloudPRNT)
**Nove migracije:** `00064` pos_integrations, `00065` product_pos_mappings.  
Sve `CREATE TABLE IF NOT EXISTS`. Nikad `DROP` na live.

---

## Checklist pre svakog `db push`

Agent (ili ti) proveri:

```bash
# 1. Sync?
supabase migration list

# 2. Šta push-ujem?
ls supabase/migrations/ | tail -3   # samo novi broj

# 3. SQL review — mora imati:
#    - IF NOT EXISTS / IF NOT EXISTS kolone
#    - bez DROP TABLE / DROP COLUMN na postojećim
#    - bez TRUNCATE

# 4. Push
supabase db push --yes

# 5. Ponovo sync
supabase migration list

# 6. App
pnpm type-check && pnpm test:run && pnpm build
```

---

## Rollback strategija (ako nešto pođe po zlu)

| Problem | Akcija |
|---------|--------|
| Nova migracija fail mid-push | Popravi SQL, **novi** fajl ili fix + retry push — ne repair na pogrešan način |
| App broken, DB OK | Revert **kod** (git), DB ostavi — outbox tabele prazne su OK |
| Outbox processor loš | Isključi QStash cron — legacy path i dalje radi (dual-write) |
| Pogrešan repair | Kontakt Supabase support / ručno u `schema_migrations` — **izbegavaj** |

**Ne postoji** “undo migration” na remote — zato jedna mala migracija po PR-u.

---

## Prompt za safe sesiju (copy-paste)

```
ADR operator mode — SAFE Supabase rollout.
Pročitaj: ADR-001-operator.md, supabase-migration-baseline.md, ADR-001-safe-rollout.md.

Pravila:
- Ne diraj 00001–00063 ponovo
- Nove migracije samo additive (IF NOT EXISTS)
- Dual-write ostaje dok A3 nije verified
- Ne db:reset, ne db:types:remote

Uradi sledeći korak (A3). Session report sa migration list na kraju. Ne commit-uj.
```

---

## Mapa: korak → rizik za Supabase

| Korak | DB schema change | Rizik |
|-------|------------------|-------|
| A3 processor | Ne (samo DML na outbox) | 🟢 Nizak |
| A4 idempotency | Ne (00062 već applied) | 🟢 Nizak |
| A5 Redis PIN | Ne | 🟢 Nema DB |
| A6 approve TX | Možda 00064 RPC kasnije | 🟡 Srednji |
| A7/A8 remove dual-write | Ne | 🟡 App-only, test pre merge |
| C1 POS tables | Da (00064+) | 🟡 additive only |

---

## Tvoja jedina odluka

| Okruženje | Preporuka |
|-----------|-----------|
| **qr-order** (`mcumfksxujgtjfjfwtpl`) | Staging + demo — agent push-uje **00064+** ovde |
| **Production** (ako odvojen) | Ti ručno promovišeš posle staging checklist-a |

Ako demo i staging dele isti projekat — i dalje safe jer sve do sada je **additive**.

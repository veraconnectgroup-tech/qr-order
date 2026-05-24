# ADR-001 — Session Prompts (copy-paste za Cursor)

> **Za tebe (Jovica):** ne čitaj ovaj fajl — koristi **[ADR-001-operator.md](./ADR-001-operator.md)** (jedna linija prompta).  
> **Za agenta:** detalji po koracima su ovde.

**Obavezna literatura (agent mora pročitati):**
- [ADR-001-operator.md](./ADR-001-operator.md) — autonomni režim
- [ADR-001-implementation-warnings.md](./ADR-001-implementation-warnings.md)
- [supabase-migration-baseline.md](./supabase-migration-baseline.md)

**Trenutni status implementacije:**

| Korak | Status |
|-------|--------|
| A1 migracije (`00061`–`00063`) | ✅ push-ovano (hibridni baseline — [supabase-migration-baseline.md](./supabase-migration-baseline.md)) |
| A2 `buildOutboxEvents` + enqueue | ✅ urađeno |
| A3 outbox processor | ✅ urađeno |
| A4 idempotency header | ⬜ sledeći |
| A5 PIN → Redis GETDEL | ⬜ |
| A6 approve/reject RPC | ⬜ |
| A7/A8 ukloni direct TSE/push | ⬜ (dual-write aktivan) |
| B2 DATEV mixed-rate | ✅ |

---

## 1. Jednokratni setup (ti uradiš jednom)

### A) Supabase CLI + link na remote projekat

Docker **nije obavezan** ako koristiš samo remote (bez `supabase start`).

```bash
# 1. Login (otvori browser — moraš biti tu jednom)
supabase login

# 2. Link projekat qr-order (ref iz Dashboard → Settings → General)
cd /Users/jovicamihajlovic/Desktop/ordering
supabase link --project-ref mcumfksxujgtjfjfwtpl

# 3. Push migracija na remote (00064+ samo)
supabase db push --yes

# 4. Tipove RUČNO u src/types/database.ts — NE db:types:remote
```

**Za potpuno autonoman agent (bez browser login-a):**  
Dashboard → Account → Access Tokens → kreiraj token, dodaj u `.env.local`:

```env
SUPABASE_ACCESS_TOKEN=sbp_...
```

Agent onda može: `supabase link --project-ref mcumfksxujgtjfjfwtpl` i `supabase db push` bez interakcije.

### A2) Baseline (baza postavljena preko cloud-setup.sql)

Ako `db push` pokuša da kreira `organizations` koja već postoji:

```bash
# Označi postojeće migracije kao primenjene (00001–00060 + seed)
supabase migration repair --status applied \
  00001 00002 00003 00004 00005 00006 00007 00008 00009 00010 \
  00011 00012 00013 00014 00015 00016 00017 00018 00019 00020 \
  00021 00022 00023 00024 00025 00026 00027 00028 00029 00030 \
  00031 00032 00033 00037 00038 00039 00040 00041 00042 00043 00044 \
  00045 00046 00047 00048 00049 00050 00051 00052 00053 00054 \
  00055 00056 00057 00058 00059 00060

# Zatim samo nove migracije
supabase db push --yes
```

Napomena: seed je u `00033_seed.sql` (preimenovan iz duplog `00004_seed.sql`).

### B) Env varijable (minimum za ADR Track A)

Već u `.env.example`. Proveri da `.env.local` ima:

| Var | Zašto |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | app + agent testovi |
| `SUPABASE_SERVICE_ROLE_KEY` | order create, outbox insert |
| `UPSTASH_REDIS_REST_URL/TOKEN` | A5 PIN cache, rate limit |
| `QSTASH_TOKEN` | background jobs (A3 cron) |
| `CRON_SECRET` | zaštita `/api/jobs/*` |
| `NEXT_PUBLIC_APP_URL` | QStash callback URL |

### C) Da li agent može sam da push-uje Supabase?

**Da — ali samo ako je projekat linkovan** (`supabase link`) i ima pristup (login ili `SUPABASE_ACCESS_TOKEN`).

| Scenario | Agent može? |
|----------|-------------|
| `pnpm db:push` (00064+ only) | ✅ |
| `pnpm db:types:remote` | ❌ lomi build — ručni tipovi |
| Kreiranje novog Supabase projekta | ❌ — ti u dashboardu |
| Menjanje RLS u produkciji bez review-a | ⚠️ ne preporučujem — agent push-uje migracije, ti review PR |

**Preporuka:** linkuj remote **staging** projekat (ne produkciju direktno). Agent push-uje migracije tamo; ti promovišeš na prod posle ručne provere.

---

## 2. Univerzalni prompt (početak svake sesije)

Kopiraj i prilagodi korak:

```
Implementiraj ADR-001 Track A — korak A3 (outbox processor).

OBAVEZNO pre koda:
1. Pročitaj docs/architecture/ADR-001-implementation-warnings.md
2. Pročitaj relevantnu sekciju u ADR-001-universal-ordering-platform.md
3. Proveri git status i šta je već urađeno (A2 outbox lib postoji u src/lib/outbox/)

Pravila:
- Jedan PR = jedan korak (A3 samo, ne A3+A4+A5 zajedno)
- NE prepisuj create-order.ts od nule
- Zadrži dual-write (direct scheduleOrderTseSign/scheduleNewOrderPush) dok A7/A8 nisu gotovi
- Min diff, postojeći konvencije

Na kraju OBAVEZNO pokreni i prijavi rezultat:
pnpm test:run
pnpm type-check
pnpm lint
pnpm build

Ako migracije nisu na remote: supabase db push --yes (samo 00064+)
Ručne tipove u src/types/database.ts ako nova migracija dodaje tabele.

Test scenariji iz warnings §9 koje ovaj korak pokriva — ručno ili unit testom.

Ne commit-uj osim ako eksplicitno tražim.
```

---

## 3. Promptovi po koracima

### A1 — Migracije (ako još nisu push-ovane)

```
Proveri ADR-001 migracije 00061, 00062, 00063 u supabase/migrations/.
- Ne spajaj u jedan fajl
- Redosled: 61 → 62 → 63
- Pokreni pnpm db:push na linkovan Supabase projekat
- Zatim pnpm db:types:remote i proveri da database.ts ima order_events i outbox_events
- Ako db:push failuje, dijagnostikuj i popravi SQL — ne preskači migracije
Ne diraj aplikacioni kod osim tipova ako treba.
```

### A3 — Outbox processor (PRIORITET)

```
Implementiraj ADR-001 A3: outbox processor.

Kreiraj:
- src/lib/outbox/processor.ts — claim batch FOR UPDATE SKIP LOCKED, max 50
- src/lib/outbox/handlers/ — registry po event_type
- src/app/api/jobs/outbox-process/route.ts — CRON_SECRET + QStash

Handleri (idempotentni):
- fulfill.notify_staff → pozovi postojeći scheduleNewOrderPush logiku
- fiscal.tse_sign → pozovi postojeći /api/jobs/tse-sign flow
- integration.webhook → pozovi dispatchWebhook za jedan config iz payload-a

Retry: exponential backoff min(300s, 2^attempts * 5s)
Dead letter: status='failed', NE brisati red

PAZI: dva cron-a ne smeju duplo procesirati — SKIP LOCKED obavezan.

Testovi: unit test za backoff + handler registry mock.
Dual-write ostaje — ne uklanjaj direct calls iz create-order (to je A7/A8).

Pročitaj ADR-001-implementation-warnings.md §3.
```

### A4 — Idempotency-Key

```
Implementiraj ADR-001 A4: Idempotency-Key na POST /api/orders.

- Header: Idempotency-Key (optional ali preporučeno)
- Storage: orders.idempotency_key (00062 migracija)
- Dupli POST sa istim key → isti orderId, HTTP 200, ne dupli insert
- Koristi postojeći create-order.ts — minimal diff
- Unit/integration test za dupli POST

Ne prepisuj create-order.ts. Pročitaj warnings §1 i §9.
```

### A5 — PIN Redis

```
Implementiraj ADR-001 A5: PIN reveal cache → Upstash Redis.

- Zameni src/lib/sessions/pin-reveal-cache.ts Map sa Redis
- Koristi isti client kao src/lib/rate-limit.ts
- consumePinReveal: atomski GETDEL, TTL 10 min
- Fajlovi: approve-order-access.ts, approval-status/route.ts

Test: store + consume vraća PIN; drugi consume vraća null.

Pročitaj warnings §2.
```

### A6 — Approve/reject transakcija

```
Implementiraj ADR-001 A6: approve-order-access.ts koraci 1-4 u jednoj transakciji.

- Koraci 5-6 već idu preko outbox (A2) — proveri da je konzistentno
- reject flow: audit preko outbox gde ima smisla
- Idempotent approve/reject (refresh ne duplira side effects)

NE prepisuj ceo fajl. Korak po korak. Pročitaj warnings §5.
```

### A7 — Ukloni direct push

```
Implementiraj ADR-001 A7: ukloni scheduleNewOrderPush direct calls.

Zameni sa outbox fulfill.notify_staff (A3 processor mora raditi).

Fajlovi: create-order.ts, approve-order-access.ts, create-staff-order.ts

Pre uklanjanja: proveri da outbox processor u staging-u procesira notify_staff.
Dodaj test ili smoke check.
```

### A8 — Ukloni direct TSE

```
Implementiraj ADR-001 A8: ukloni scheduleOrderTseSign direct calls.

Zameni sa outbox fiscal.tse_sign handler.

Standalone lokacije: fiskaly mora ići preko outbox retry.
Vorsystem (POS connected): nema tse_sign event — proveri buildOutboxEvents.

Pre uklanjanja: outbox processor mora raditi u staging-u.
```

### B1 — TSE retry (overlap sa A8)

```
Proveri da fiscal.tse_sign outbox handler:
- Retry kad fiskaly API down
- Idempotent (već potpisan order preskače)
- Ne zove fiskaly u vorsystem modu

Dodaj test za retry backoff i skip-already-signed.
```

---

## 4. Checklist provera (agent popunjava na kraju sesije)

```markdown
## Session report — A?

### Šta je urađeno
- [ ] ...

### Komande
- [ ] pnpm test:run — PASS/FAIL
- [ ] pnpm type-check — PASS/FAIL
- [ ] pnpm lint — PASS/FAIL
- [ ] pnpm build — PASS/FAIL
- [ ] pnpm db:push — PASS/SKIP/N/A (samo 00064+)
- [ ] database.ts ručno — DONE/SKIP/N/A

### Scenariji (warnings §9)
- [ ] Dupli Idempotency-Key — N/A / tested
- [ ] Partial order rollback — N/A / tested
- [ ] POS fail + printer ok — N/A
- [ ] fiskaly down + retry — N/A / tested
- [ ] Approve + refresh PIN — N/A / tested
- [ ] DATEV mixed 19%+7% — N/A (B2 done)

### Rizici / follow-up
- ...
```

---

## 5. Brzi promptovi za održavanje

**Samo provera stanja:**
```
Proveri ADR-001 implementacioni status: git diff, koje track korake su done,
da li su migracije 00061-63 push-ovane, i šta je sledeći korak.
Ne piši kod osim ako nešto kritično nedostaje.
```

**Push migracija:**
```
Linkovan je Supabase (hibridni baseline). supabase migration list — proveri sync.
Push samo ako ima 00064+ pending: supabase db push --yes
Tipove ručno u database.ts. Ne commit-uj osim ako tražim.
```

**Samo testovi:**
```
Pokreni punu verifikaciju: test:run, type-check, lint, build.
Prijavi sve failure sa fajlom i linijom. Popravi samo ako je jasno broken od ADR rada.
```

---

## 6. Supabase — moja preporuka

| Pristup | Prednosti | Mane |
|---------|-----------|------|
| **Remote staging + `db push`** | Agent radi autonomno, ista baza kao Vercel preview | Treba link + token jednom |
| **Lokalni Docker + `db reset`** | Brz reset, offline | Docker mora biti up — kod tebe trenutno nije |
| **Ručno SQL u dashboardu** | Bez CLI | Agent ne može sam, lako se desi drift |

**Preporučeni flow:**

1. **Staging** Supabase projekat linkovan u repo (`supabase link`)
2. `SUPABASE_ACCESS_TOKEN` u `.env.local` → agent push-uje bez tebe
3. Vercel preview env pokazuje na isti staging Supabase
4. **Production** — ti ručno promovišeš migracije posle što staging prođe checklist §4

**Ne linkuj production direktno** na autonomni agent — staging first.

---

## 7. Cursor rule (već aktivno)

`.cursor/rules/project.mdc` referencira ADR warnings.  
Za svaku sesiju dovoljno je univerzalni prompt iz §2 + korak iz §3.

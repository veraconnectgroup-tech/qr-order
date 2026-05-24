# ADR-001 — Operator mode (za Jovicu)

> **Ti ne moraš da vodiš provere.** Agent čita ovaj fajl + warnings + baseline.  
> Ti samo nalepiš **jednu liniju** ispod.

---

## Šta TI radiš (minimum)

| Jednom | Povremeno |
|--------|-----------|
| `supabase login` + link (već urađeno) | Merge PR kad agent javi "spremno za review" |
| `.env.local` popunjen | "commituj" ili "napravi PR" ako hoćeš |
| (opciono) `SUPABASE_ACCESS_TOKEN` u env | |

**Ne moraš:** da čitaš ADR, da pokrećeš testove, da pratiš migration brojeve.

---

## Promptovi — kopiraj jedan

### 🟢 Default (agent bira sledeći korak)

```
ADR operator mode. Pročitaj docs/architecture/ADR-001-session-prompts.md (Operator checklist).
Uradi sledeći nedovršeni ADR-001 korak (Track A prioritet). Sam vodi provere i Supabase.
Na kraju session report. Ne commit-uj.
```

### 🟡 Konkretan korak

```
ADR operator mode — korak A3.
Pročitaj warnings + baseline. Sam vodi provere. Session report na kraju. Ne commit-uj.
```

Zameni `A3` sa: `A4`, `A5`, `A6`, `A7`, `A8`, `B1`.

### 🔵 Samo provera (bez koda)

```
ADR status check. Proveri git, migracije, šta je done, šta je next. Session report. Bez koda.
```

### 🟣 Commit / PR (kad si zadovoljan)

```
Commituj ADR A3 rad sa porukom u stilu repoa. Ne push-uj.
```

ili

```
Napravi PR za trenutni branch. Ne force push.
```

---

## Šta AGENT radi automatski (ne moraš tražiti)

Svaka sesija u "operator mode":

1. **Pročita** (pre koda):
   - `ADR-001-implementation-warnings.md`
   - `supabase-migration-baseline.md`
   - `ADR-001-session-prompts.md` → tabela statusa
   - `git status` + relevantni diff

2. **Implementira** tačno **jedan** korak (A3, A4…)

3. **Pokrene** (uvek):
   ```bash
   pnpm test:run
   pnpm type-check
   pnpm lint
   pnpm build
   supabase migration list   # ako dira migracije
   ```

4. **Supabase pravila:**
   - Link: `mcumfksxujgtjfjfwtpl` (qr-order)
   - **NE** ponovo push 00001–00060
   - **NE** `db:reset` na remote
   - **NE** `pnpm db:types:remote` — tipove ručno u `database.ts`
   - Nove migracije: `supabase db push --yes`

5. **Na kraju** ispiše **Session report** (template ispod)

6. **Ne commit-uje** osim ako kažeš

---

## Redosled koraka (agent prati ovo)

```
✅ A1  migracije 61–63 (push-ovano, hibridni baseline)
✅ A2  buildOutboxEvents + enqueue
✅ A3  outbox processor
✅ A4  Idempotency-Key
✅ A5  PIN → Redis GETDEL
✅ A6  approve/reject TX (RPC 00065)
✅ A7  ukloni direct push (outbox-only)
✅ A8  ukloni direct TSE (outbox-only)
✅ B2  DATEV mixed-rate (mrtav resolveRevenueAccount uklonjen)
```

**Track A: gotov.** Sledeći: Track B3+ (Beleg, Z-Bon) ili Track C.

---

## Session report (agent popunjava)

```markdown
## ADR session — [A3 / status check / …]

### Urađeno
- …

### Verifikacija
| Check | Rezultat |
|-------|----------|
| test:run | PASS/FAIL |
| type-check | PASS/FAIL |
| lint | PASS/FAIL |
| build | PASS/FAIL |
| migration list | synced / N/A |

### Supabase
- Push: da/ne, koje migracije
- Baseline: poštovan / N/A

### Test scenariji (§9 warnings)
- … (N/A ili tested)

### Sledeći korak
- …

### Rizici / tvoja odluka potrebna
- … (ili "nema")
```

---

## Primeri realnih sesija

**Sutra ujutru, 10 sekundi:**
> ADR operator mode. Uradi sledeći korak. Ne commit-uj.

**Petak review:**
> ADR status check. Bez koda.

**Spreman za merge:**
> Commituj i napravi PR.

---

## Gde je detalj

| Tema | Fajl |
|------|------|
| **Safe Supabase (čitaj prvo)** | `ADR-001-safe-rollout.md` |
| Arhitektura | `ADR-001-universal-ordering-platform.md` |
| Zamke | `ADR-001-implementation-warnings.md` |
| Hibridne migracije | `supabase-migration-baseline.md` |
| Detaljni promptovi po koraku | `ADR-001-session-prompts.md` §3 |

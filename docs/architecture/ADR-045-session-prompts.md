# ADR-045 — Session Prompts (Denis Multi-Memory Model)

> **Operator prompt (jedna linija, menjaj samo S broj):**
>
> ```
> ADR-045 sesija S1. Pročitaj docs/architecture/ADR-045-session-prompts.md
> (obavezna literatura + tvoja sesija + pravila) i docs/architecture/ADR-045-denis-memory-model.md.
> Proveri status tabelu — radi SAMO svoju sesiju, jedan PR.
> Integracioni check sa dokazima. Session report. Ažuriraj status tabelu. Ne commit-uj.
> ```

---

## Obavezna literatura (pročitaj PRE koda)

1. [ADR-045-denis-memory-model.md](./ADR-045-denis-memory-model.md) — nivoi §2, odluke §4, anti-ciljevi §6
2. [.cursor/rules/commit-checklist.mdc](../../.cursor/rules/commit-checklist.mdc) — posebno §4 (in-memory = bug na serverless)
3. [ADR-042-venue-rhythm-priors.md](./ADR-042-venue-rhythm-priors.md) — Restaurant nivo već postoji tamo
4. [ADR-012-fiscal-journal-spine.md](./ADR-012-fiscal-journal-spine.md) — audit se ne briše automatski
5. `src/lib/data-retention.ts` — postojeće retencione konstante
6. Pravila za agente iz [ADR-043-session-prompts.md](./ADR-043-session-prompts.md) ("Pravila za svakog agenta") — važe identično, uključujući baseline test failova.

## Status implementacije (ažuriraj posle svake sesije)

| Sesija | Status | Ključni fajlovi |
|--------|--------|-----------------|
| **S1 — Memory registar + mapa** | ⬜ | |
| **S2 — Day Close pipeline** | ✅ | `src/lib/denis/memory/day-close.ts`, `src/app/api/cron/daily-closing/route.ts`, `src/lib/denis/stations/station-questions.ts`, `supabase/migrations/00160_denis_day_closes.sql`, `src/types/database.ts` |
| **S3 — Retencija izvršna + zaboravi me** | ⬜ | |
| **S4 — Granice čitanja** | ⬜ | |
| **S5 — Pilot + verifikacija** | ⬜ | |

---

## S1 — Memory registar + mapa

### Cilj

Svaki store/tabela koju Denis koristi dobija deklaraciju: nivo (live/shift/restaurant/audit) · retencija · Day Close ponašanje (`close | rollup | keep | delete | anonymize`) · PII da/ne. Registar je izvor istine za S2–S4.

### Implementacija

1. **Popis** (najveći deo posla): pregledaj tabele u `src/types/database.ts` + store module u `src/lib/denis`, `src/lib/guest`, `src/lib/admin` — za svaku Denis-relevantnu tabelu/store odredi nivo po ADR-045 §2. Sporne slučajeve (npr. `denis_timeline` — shift deo vs audit deo) rezoluj i dokumentuj obrazloženje.
2. **Registar** `src/lib/denis/memory/memory-registry.ts` — čist deklarativni objekat (read-only konstanta, dozvoljena po commit-checklist §4), tipovi + helpers (`getMemoryLevel(table)`, `entriesForDayClose()`, `entriesWithExpiredRetention(now)`).
3. **Čuvar ažurnosti**: test koji poredi registar sa listom tabela iz `database.ts` — nova Denis tabela bez registarske deklaracije = crven test sa jasnom porukom ("dodaj u memory-registry sa nivoom i retencijom").
4. **Retencija**: povuci postojeće vrednosti iz `data-retention.ts` gde postoje; gde ne postoje, predloži (konzervativno) i dokumentuj GoBD/GDPR obrazloženje po nivou.

### Šta NE raditi

- Nula promena ponašanja — ova sesija ništa ne briše, ne seli, ne zatvara. Samo imenuje i testira.

### Integracioni check

- [ ] Registar pokriva sve Denis-relevantne tabele (test poređenja crven na nepokrivenu)
- [ ] Svaki unos ima nivo + retenciju + dayClose + PII flag
- [ ] Sporni slučajevi dokumentovani sa obrazloženjem (u kodu, uz unos)
- [ ] Nula novih test failova vs baseline

---

## S2 — Day Close pipeline

### Cilj

Smena se zatvara eksplicitno: shift stanje se zatvara, važno ide u recap, patterni u Restaurant nivo, audit ostaje, privremeni guest kontekst se briše/anonimizuje. Idempotentno, sa zapisom.

### Implementacija

1. **Trenutak**: zakači se na postojeći kraj dana — nađi gde se pokreće daily report / fiscal daily closing (`grep -rn "daily-closing\|run-daily-report" src/lib`) i dodaj Day Close korak POSLE njih (recap mora prvo da pročita smenu). Ne novi cron ako postojeći tick/cron može.
2. **Pipeline** `src/lib/denis/memory/day-close.ts`: iterira `entriesForDayClose()` iz registra; po ponašanju: `close` (npr. otvorena `station_questions` → expired sa razlogom "day_close"; otvorene obligations → po postojećem expiry pravilu), `rollup` (potvrdi da je ADR-042 rollup prošao — ne dupliraj ga), `delete`/`anonymize` (privremeni guest signali po registru), `keep` (audit — no-op).
3. **Idempotencija**: Day Close zapis po lokaciji+datumu (gde — odluči: postojeća admin tabela ili nova mala tabela sa RLS; dokumentuj); ponovljen poziv za isti dan = no-op sa logom.
4. **Zapis**: šta je obrađeno/preskočeno/palo — u Day Close red (JSONB summary).

### Šta NE raditi

- Ne diraj fiskalni daily closing sadržaj — samo redosled (posle njega).
- Ne briši ništa što registar ne kaže eksplicitno.

### Integracioni check

- [ ] Test: dva poziva za isti dan ⇒ drugi no-op
- [ ] Test: otvorena station_questions posle Day Close ⇒ expired sa razlogom day_close
- [ ] Test: audit unosi netaknuti posle Day Close
- [ ] Redosled: recap/daily report čita smenu PRE zatvaranja (grep/test dokaz)
- [ ] Nula novih test failova vs baseline

---

## S3 — Retencija izvršna + "zaboravi me"

### Cilj

Deklarisana retencija se stvarno sprovodi: periodični job briše/anonimizuje isteklo po registru. Guest "zaboravi me" briše SVE lične tragove tog gosta odjednom. Audit se NIKAD ne briše automatski.

### Implementacija

1. **Retencioni job**: nađi postojeći maintenance/cron mehanizam (`grep -rn "cron\|maintenance" src/app/api src/lib` — watcher tick? postojeći scheduled job?) i dodaj retencioni prolaz: `entriesWithExpiredRetention(now)` → batch delete/anonymize sa limitom po prolazu (ne masakr u jednom query-ju). Audit unosi HARD-izuzeti u kodu (ne samo u registru — dupli pojas).
2. **"Zaboravi me"**: postojeći guest memory mehanizam (`src/lib/guest/denis-guest-memory-*` — ako "forget" put postoji iz ADR-043 S11, proširi) → briše device memory + anonimizuje guest-vezane shift tragove po registru (PII flag). Order/fiskal podaci OSTAJU (zakonska obaveza) — anonimizuje se veza ka gostu, ne račun.
3. **Log**: svaki retencioni prolaz upiše šta je obrisao (brojevi po tabeli) — bez PII u logu.

### Šta NE raditi

- Ne brisanje audit/fiskal podataka — nikad automatski, ni sa flagom.
- Ne sinhrono brisanje u guest request-u ako je skupo — može queued (postojeći outbox pattern ako postoji).

### Integracioni check

- [ ] Test: isteklo po registru ⇒ obrisano/anonimizovano; neisteklo netaknuto
- [ ] Test: audit tabela u registru sa isteklom "retencijom" ⇒ job je PRESKAČE (hard izuzetak)
- [ ] Test: zaboravi me ⇒ device memory prazan + PII tragovi anonimizovani + order podaci netaknuti
- [ ] Batch limit radi (test sa više redova od limita)
- [ ] Nula novih test failova vs baseline

---

## S4 — Granice čitanja

### Cilj

Tri granice iz ADR-045 §4.4 sprovedene u kodu, ne u dokumentaciji: guest turn ne čita audit · learning ne čita PII · jučerašnje shift stanje ne utiče na danas.

### Implementacija

1. **Mapa čitanja** (prvi korak): za svaki audit store iz registra — ko ga danas čita (`grep -rn "<tabela>" src/lib/denis/runtime src/lib/ai`)? Za guest memory — čita li ga learning (`src/lib/denis` learned-edges, rhythm, outcome loop)? Tabela u report.
2. **Guardovi**: gde granica već važi — samo test koji je zaključava. Gde ne važi — popravi čitanje (agregat umesto PII, današnji filter umesto svega) i test.
3. **Shift filter**: potvrdi da fold/watcher čitaju samo današnju smenu (datum/session filter) — ako neko čita šire, to je ili Restaurant podatak (preusmeri na rhythm/learned) ili bug (popravi).
4. **Lint pravilo ili test-konvencija**: novi kod u `src/lib/ai`/guest turn putevima ne sme da importuje audit module (kako — odluči: eslint no-restricted-imports zona ili arhitekturni test; dokumentuj).

### Šta NE raditi

- Ne refaktorisanje modula radi granica — najmanji zahvat koji granicu čini testabilnom.

### Integracioni check

- [ ] Mapa čitanja u reportu (audit → čitaoci, guest PII → čitaoci)
- [ ] Test po granici: guest turn bez audit čitanja · learning bez PII · fold samo današnja smena
- [ ] Mehanizam koji drži granicu za budući kod (lint/test) radi — dokaz sa namernim prekršajem
- [ ] `pnpm eval:denis` bez novih failova (diraš turn puteve)
- [ ] Nula novih test failova vs baseline

---

## S5 — Pilot + verifikacija

### Cilj

Životni ciklus jednog dana dokazan od otvaranja do Day Close. Verifikaciona sesija — kod samo za trivijalne bugfixove.

### Scenario walk-through (svaki korak sa dokazom)

1. Tokom "dana": shift signali nastaju (sto žuri, pitanje kuhinji, obligation) — svi u registru kao shift nivo
2. Osetljiva akcija (void sa razlogom) — audit nivo
3. Day Close: recap generisan PRE zatvaranja · otvorena pitanja → expired(day_close) · rollup potvrđen · privremeni guest kontekst anonimizovan · audit netaknut
4. Ponovljen Day Close ⇒ no-op
5. Sutradan: fold NE vidi jučerašnje shift stanje; rhythm/learned vide pattern
6. "Zaboravi me" ⇒ device memory prazan, računi netaknuti
7. Retencioni job na mock isteklim podacima ⇒ briše tačno po registru, audit preskočen
8. **Regresija**: `pnpm test:run` (baseline), `type-check`, `lint`, `build`, `eval:denis`

**Go kriterijum:** nijedan audit red nije nestao · nijedan jučerašnji shift podatak ne utiče na današnju odluku · registar pokriva 100% Denis tabela.

---

## Session report šablon

Isti kao ADR-043 (vidi tamo).

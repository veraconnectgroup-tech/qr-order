# ADR-045 — Denis Multi-Memory Model

**Status:** Approved · **Datum:** 2026-07-01
**Sesije:** [ADR-045-session-prompts.md](./ADR-045-session-prompts.md)
**Redosled:** posle ADR-043 (station truth + host/revenue) i ADR-044 (loss prevention) — memorija klasifikuje ono što oni proizvode.

> **Glavna odluka:** Denis ne pamti sve zauvek. Denis pamti **pravu stvar na pravom nivou** — i zna razliku između "sto 8 je danas nervozan" (smena), "petkom od 20h bar kasni" (restoran) i "voidovana 2 Aperola posle served" (audit).

---

## 1. Zašto (vlasnikova perspektiva)

Vlasnik želi da Denis pamti ono što **štiti posao** — ali gost i osoblje ne žele osećaj da AI skuplja sve bez reda. Poverenje se gradi tako što je jasno: šta se pamti, koliko dugo, i šta se briše na kraju dana.

## 2. Četiri nivoa memorije (zakucano)

| Nivo | Živi | Pamti | Primer |
|------|------|-------|--------|
| **Live** | sekunde–minuti | realtime stanje: aktivni stolovi, šta je spremno, ko čeka | "sto 4 čeka piće 11 min" |
| **Shift** | otvaranje → Day Close | današnja igra: privremene napomene, ko je nervozan, šta je Denis već pitao (anti-spam), otvoreni pozivi | "sto 8 žuri" |
| **Restaurant** | trajno | znanje o restoranu: ritmovi, parovi, vremena stanica, šta radi u preporukama, pravila i stil | "subotom 19:30–20:30 mains kasne +18%" |
| **Audit** | dugoročno, ne briše se olako | dokaz: ko/šta/kad/zašto za svaku osetljivu akciju, payment reference, timeline | "void 2× Aperol posle served, 21:14, razlog X" |

**Pravila raspodele:**

- Shift sme da zaboravi detalj. **Audit ne sme.** Restaurant ne pamti lične sitnice bez razloga.
- Lične stvari gosta žive u device-bound guest memory (postojeći mehanizam, opt-out) — nikad u Restaurant nivou.
- Nijedan podatak ne postoji na dva nivoa kao izvor istine — jedan nivo je vlasnik, ostali čitaju.

## 3. Šta već postoji (mapa — Denis već IMA sve četiri memorije, samo neimenovane i bez Day Close)

| Nivo | Postojeće u kodu |
|------|------------------|
| Live | fold/session state, realtime engine, copilot snapshot |
| Shift | watcher stanje, `station_questions`, anti-spam cooldowni, waiter obligations, `denis_timeline` (današnji deo) |
| Restaurant | rhythm priors (ADR-042), `denis-learned-edges.ts`, discovered pairings, nudge outcome learning (ADR-039), ConciergeConfig |
| Audit | `order_events`, ADR-044 journal, fiskalni spine (ADR-011/012), `data-retention.ts` |

**Problem nije da memorija ne postoji — problem je što ništa ne sprovodi granice:** shift stvari se ne zatvaraju eksplicitno, retencija nije svuda definisana, i nigde ne piše koji store pripada kom nivou.

## 4. Zakucane odluke

### 4.1 Registar memorije, ne nova infrastruktura

Jedan deklarativni registar (`src/lib/denis/memory/memory-registry.ts`): svaki store/tabela → nivo → retencija → Day Close ponašanje → PII da/ne. **Kod ne seli podatke u nove tabele** — registar imenuje postojeće i sprovodi pravila nad njima.

### 4.2 Day Close pipeline

Na zatvaranju dana (zakačen na postojeći daily-report/fiscal daily-closing trenutak, ne novi cron):

1. Shift stanje → zatvara se (expiry otvorenih pitanja/obaveza sa razlogom "day close")
2. Važno iz smene → Shift Recap (ADR-043 S6 — već postoji)
3. Operativni patterni → Restaurant nivo (rhythm rollup — ADR-042 već radi; Day Close samo potvrđuje da je prošao)
4. Osetljive akcije → ostaju u Audit (ništa se ne radi — samo se NE briše)
5. Privremeni guest kontekst → briše se ili anonimizuje po registru

Day Close je **idempotentan** (može se ponoviti bez štete) i piše svoj zapis (kad, šta je obrađeno, šta preskočeno).

### 4.3 Retencija se sprovodi, ne samo deklariše

`data-retention.ts` postaje izvršan nad registrom: periodični job briše/anonimizuje isteklo po nivou. Audit retencija poštuje GoBD (dugogodišnja) — brisanje audita SAMO kroz eksplicitni compliance tok, nikad automatski.

### 4.4 Granice čitanja

- Guest turn NE čita Audit nivo (gostu ne treba i ne sme).
- Restaurant learning NE čita PII iz guest memory — samo agregate.
- Shift stanje iz prošlih dana NE utiče na današnje odluke (za to postoji Restaurant nivo).

## 5. Sesije

| # | Sesija | Šta daje |
|---|--------|----------|
| S1 | Memory registar + mapa | Svaki store imenovan, nivo, retencija, PII — i lint/test koji drži registar ažurnim |
| S2 | Day Close pipeline | Smena se zatvara eksplicitno, idempotentno, sa zapisom |
| S3 | Retencija izvršna + "zaboravi me" | Isteklo se stvarno briše/anonimizuje; guest opt-out kompletan |
| S4 | Granice čitanja | Guardovi: guest turn ↛ audit, learning ↛ PII, jučerašnji shift ↛ danas |
| S5 | Pilot + verifikacija | Ceo životni ciklus jednog dana dokazan |

## 6. Anti-ciljevi

- **Ne** nova memorijska infrastruktura / vector store / "memory service" — registar nad postojećim
- **Ne** seljenje podataka između tabela radi estetike
- **Ne** automatsko brisanje audita — samo compliance tok
- **Ne** pamćenje sadržaja razgovora u Restaurant nivou

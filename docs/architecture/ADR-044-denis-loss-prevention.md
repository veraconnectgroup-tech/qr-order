# ADR-044 — Denis Owner Control & Loss Prevention (Denis čuva kuću)

**Status:** Approved · **Datum:** 2026-07-01
**Sesije:** [ADR-044-session-prompts.md](./ADR-044-session-prompts.md)
**Prethodi:** ADR-043 (station truth + host/revenue) — **ADR-044 kreće tek posle ADR-043 S7 "go"** (guardrails čitaju station istinu i timeline).

> **Jedna rečenica:** Denis gleda svaku finansijsku i operativnu mutaciju — nijedna stavka, plaćanje, popust, transfer stola ili refund ne sme da nestane bez razloga, vidljivosti za vlasnika i audit traga.

---

## 1. Zašto (vlasnikova perspektiva)

Vlasnik koji je ceo dan u restoranu zna: nije problem samo prodati više. Problem je da ono što je prodato **stvarno bude naplaćeno, evidentirano i čisto zatvoreno**. Haos, greške i malverzacije izgledaju isto dok ne pogledaš timeline. Vlasnik želi da zna:

- ko je prebacio porudžbinu sa stola na sto · ko je obrisao stavku · ko je dao popust
- ko je naplatio keš · ko je zatvorio račun · da li je račun naplaćen dvaput
- da li je gost platio a sto nije zatvoren · da li je sto zatvoren a plaćanje nije prošlo
- da li je konobar označio delivered bez preuzimanja
- da li je nešto izdvojeno/splitovano posle naplate · da li se ista stavka seli između stolova

## 2. Ton (zakucano — pravno i ljudski)

Denis je **vlasnik koji vidi nelogičnosti, ne policajac**:

- Denis NIKAD ne kaže "konobar krade" / ne imenuje krivca.
- Denis kaže: **"Ova akcija je nelogična i treba proveru."** + tačan trag (ko/šta/kad/kontekst).
- Guardrail blokira ili traži razlog/odobrenje — presudu donosi čovek.
- Svaki flag ima ishod (proveren: u redu / problem) — flagovi bez ishoda su buka.

## 3. Šta već postoji (mapirano — ne graditi ponovo)

| Oblast | Postojeće |
|--------|-----------|
| Transferi stolova | `src/app/api/table-transfers/route.ts` + scene refresh |
| Split / merge | `src/app/api/orders/[orderId]/split/route.ts` · `table-sessions/merge` |
| Refund | `src/lib/stripe/refund.ts` (već ima audit zapis) |
| Popusti/promo | `src/lib/promo/` + pricing pipeline (`compute-pricing.ts`, `compute-totals.ts`) |
| Fiskal | `src/lib/fiscal/` — beleg, daily-closing, storno testovi, ADR-011/012 spine |
| Audit trag | `order_events` (order-level) · `src/lib/operator/audit-log.ts` (operator-level) |
| Order timeline | ADR-043 S5 — `loadOrderTimeline` |
| Station istina | ADR-043 S1 — `order_station_states` (served ne može bez ready) |
| Permission katalog | `src/lib/auth/permission-catalog.ts` (ADR-024) |

## 4. Zakucane odluke

### 4.1 Jedan journal za osetljive akcije — ne pet malih

Sve osetljive mutacije (void, popust, transfer, split/merge, refund, manual price override, payment mismatch, manager override) pišu u **jedan append-only tok** sa istom shemom: ko · šta · kad · nad čim · razlog · odobrio (ako treba) · risk flag. Tehnički: proširenje/standardizacija `order_events` + session-level ekvivalent — **ne novi paralelni event store** (postojeći ADR-012 append-only princip).

### 4.2 Guardrail lestvica po fazi porudžbine (void primer)

| Faza | Pravilo |
|------|---------|
| pre pripreme (`queued`) | dozvoljeno, tihi zapis |
| posle početka pripreme (`in_prep`) | **razlog obavezan** |
| posle `served` | **manager odobrenje** |
| posle plaćanja | **blok** — jedini put je storno/refund tok (fiskalno ispravan) |

Ista lestvica logike (dozvoli → razlog → odobrenje → blok) važi za sve osetljive akcije, pragovi po akciji.

### 4.3 Invarijante novca (matematika, ne mišljenje)

1. **Split/merge:** total pre = total posle. Razlika ≠ 0 ⇒ blok ili flag: "Split mismatch: pre 84.50€, posle 78.50€. Razlika 6.00€."
2. **Plaćanje:** naplaćeno ne sme > 1× po računu (idempotencija) · iznos < open balance ⇒ delimično plaćanje eksplicitno, ne "paid".
3. **Zatvaranje:** sto zatvoren ⇔ balans 0 ili razlog (walk-out, comp) zapisan.
4. **Served truth:** konobar ne može `served` ako stanica nije `ready`/`picked_up` (ADR-043 station chain to već sprečava — ovde flag za pokušaje + manager override put).

### 4.4 Keš = posebna pažnja

Keš nema Stripe trag, ima samo fiskalni. Pravila: cash paid bez fiscal receipt reference ⇒ flag · refund kešom ⇒ razlog + manager · gomilanje cash voidova kod istog konobara ⇒ dnevni pattern flag · manual price override ⇒ uvek zapis.

### 4.5 Flagovi idu vlasniku, ne konobaru

Suspicious flagovi se NE prikazuju osoblju (osim blokova/traženja razloga u momentu akcije). Idu u: Operations Center (odmah, samo manager/owner) + Owner daily suspicious report (kraj dana). Pristup po ADR-024 permission katalogu — novi permission `audit.suspicious.view`.

### 4.6 Anti-paranoja pravila

- Pragovi konzervativni, config po lokaciji (`ops.lossPrevention.*`) — mala kafana ≠ klub sa 40 stolova.
- Pattern flagovi porede konobara sa **prosekom lokacije**, ne apsolutnim brojem.
- Sve default **off** osim čistog audit zapisa (zapis uvek radi — flagovi/blokovi se uključuju postepeno).

## 5. Sesije

| # | Sesija | Vlasnikov problem |
|---|--------|-------------------|
| S1 | Journal osetljivih akcija (temelj) | "Hoću trag za svaku osetljivu akciju — ko, šta, kad, zašto" |
| S2 | Void lestvica | "Obrisana 2 Aperola posle serviranja — gde su otišla?" |
| S3 | Transfer + split/merge invarijante | "Zašto se porudžbina selila sa stola 4 na 9 posle delimične naplate?" |
| S4 | Payment guardrails | "Naplaćeno dvaput / plaćeno a sto zjapi otvoren / zatvoren a nenaplaćen" |
| S5 | Keš rizik + manual override | "Keš je najlakše da iscuri" |
| S6 | Popust patterni | "Isti konobar, deseti popust ove nedelje — kome i zašto?" |
| S7 | Owner suspicious report + Operations Center sekcija | "Uveče hoću listu nelogičnosti, ne roman" |
| S8 | Pilot + E2E verifikacija | "Dokaži da flag stigne do mene i da ima ishod" |

## 6. Anti-ciljevi

- **Ne** optuživanje — samo "treba proveru" + trag; bez score-ovanja "poštenja" konobara
- **Ne** novi event store — ADR-012 append-only princip, postojeći order_events prošireni
- **Ne** ML anomaly detection — deterministička pravila i invarijante (pragovi u config-u)
- **Ne** blokiranje operative zbog sumnje — blok samo kod tvrdih invarijanti (novac se ne slaže), sve ostalo je flag
- **Ne** diranje fiskalnog spine-a (ADR-011/012) — guardrails ga čitaju, ne menjaju

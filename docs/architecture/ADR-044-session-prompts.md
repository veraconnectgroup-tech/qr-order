# ADR-044 — Session Prompts (Denis čuva kuću — Loss Prevention)

> **Operator prompt (jedna linija, menjaj samo S broj):**
>
> ```
> ADR-044 sesija S1. Pročitaj docs/architecture/ADR-044-session-prompts.md
> (obavezna literatura + tvoja sesija + pravila) i docs/architecture/ADR-044-denis-loss-prevention.md.
> Proveri status tabelu — radi SAMO svoju sesiju, jedan PR.
> Integracioni check sa dokazima. Session report. Ažuriraj status tabelu. Ne commit-uj.
> ```

---

## Obavezna literatura (pročitaj PRE koda)

1. [ADR-044-denis-loss-prevention.md](./ADR-044-denis-loss-prevention.md) — ton §2, odluke §4, anti-ciljevi §6
2. [.cursor/rules/commit-checklist.mdc](../../.cursor/rules/commit-checklist.mdc)
3. [ADR-012-fiscal-journal-spine.md](./ADR-012-fiscal-journal-spine.md) — append-only princip; **fiskalni spine se NE dira**
4. [ADR-024-staff-duties-access.md](./ADR-024-staff-duties-access.md) — permission katalog
5. Ako diraš DB: [ADR-001-safe-rollout.md](./ADR-001-safe-rollout.md) + [supabase-migration-baseline.md](./supabase-migration-baseline.md)
6. Pravila za agente iz [ADR-043-session-prompts.md](./ADR-043-session-prompts.md) ("Pravila za svakog agenta") — važe identično i ovde, uključujući baseline test failova.

## Status implementacije (ažuriraj posle svake sesije)

| Sesija | Status | Ključni fajlovi |
|--------|--------|-----------------|
| **S1 — Journal osetljivih akcija** | ✅ | `00161_order_sensitive_actions.sql`, `record-sensitive-action.ts`, wire rute |
| **S2 — Void lestvica** | ✅ | `evaluate-void-ladder.ts`, `resolve-void-phase.ts`, PATCH orders |
| **S3 — Transfer + split/merge invarijante** | ✅ | `assert-total-preserved.ts`, transfer/split wire |
| **S4 — Payment guardrails** | ✅ | `payment-guardrails.ts`, session close route |
| **S5 — Keš rizik + manual override** | ✅ | `cash-risk.ts`, bill settle, storno guard, cron sweep · manual price override nema puta |
| **S6 — Popust patterni** | ✅ | `discount-patterns.ts`, journal na create-order |
| **S7 — Owner suspicious report** | ✅ | digest u daily report, Ops Center, `audit.suspicious.view` |
| **S8 — Pilot + E2E verifikacija** | ✅ | `loss-prevention.test.ts` |

> **Preduslov celog ADR-a:** ADR-043 S7 "go". Guardrails čitaju station istinu (S1) i timeline (S5).
> **Ton u SVAKOJ poruci/flagu:** "nelogična akcija, treba proveru" — nikad optužba. Vidi ADR-044 §2.

---

## S1 — Journal osetljivih akcija (temelj)

### Scena iz sale

Vlasnik uveče pita: "Ko je danas dirao račun stola 9?" Danas odgovor ne postoji na jednom mestu — deo je u order_events, deo u Stripe logu, deo nigde. Vlasnik hoće JEDNO mesto: ko, šta, kad, nad čim, zašto.

### Cilj

Svaka osetljiva akcija (void, popust, transfer, split, merge, refund, price override, manager override, payment mismatch) upisuje standardizovan zapis u jedan append-only tok. Ova sesija NE donosi flagove ni blokove — samo kompletan trag.

### Implementacija

1. **Mapa postojećeg** (prvi korak, u session report): šta danas upisuje `order_events` (`grep -rn "order_events" src/lib src/app/api`), šta `operator/audit-log.ts`, šta refund audit u `stripe/refund.ts`. Tabela: akcija → postoji li zapis → gde → šta fali.
2. **Standardna shema zapisa** — proširi `order_events` upis (ili dodaj kolone novom migracijom ako fale): `actor_staff_id`, `action` (enum osetljivih akcija), `target` (order/item/session/payment id), `reason` (nullable), `approved_by` (nullable), `context` (JSONB — iznosi pre/posle, stolovi od/do). Session-level akcije (transfer, merge) koje nemaju order → odluči: session_id kolona u istoj tabeli ili postojeći session event tok — dokumentuj izbor.
3. **Helper** `src/lib/audit/record-sensitive-action.ts` — JEDNA funkcija koju sve rute zovu; unutar iste transakcije gde je mutacija kad je moguće (RPC), inače odmah posle sa error logom ako upis padne (upis ne sme tiho da nestane).
4. **Pokrij postojeće rute** (bez promene ponašanja — samo dodaj zapis gde fali): void/izmene u `PATCH /api/orders/[orderId]`, `table-transfers`, `orders/[orderId]/split`, `table-sessions/merge`, refund tok, promo primena u pricing pipeline-u.
5. **Retencija**: zapisi su audit — dodaj u `DATA_RETENTION` (`src/lib/data-retention.ts`) dugu retenciju (dokumentuj koliko i zašto — GoBD kontekst).

### Šta NE raditi

- Ne novi event store / tabela ako `order_events` + postojeći tokovi mogu da ponesu (ADR-012 princip).
- Ne flagovi, ne pragovi, ne notifikacije — to su S2–S7.
- Ne diraj fiskalni journal.

### Integracioni check

- [ ] Tabela pokrivenosti u reportu: svaka osetljiva akcija → ruta → zapis potvrđen (test ili grep)
- [ ] `grep -rn "record-sensitive-action\|recordSensitiveAction" src/` — sve rute idu kroz JEDAN helper
- [ ] Zapis u istoj transakciji gde postoji RPC (grep dokaz po ruti)
- [ ] Retencija definisana u `data-retention.ts`
- [ ] Nula novih test failova vs baseline

---

## S2 — Void lestvica

### Scena iz sale

"2× Aperol void posle served statusa. Razlog nije unet." — to vlasnik danas ne vidi. Nekad je greška kucanja, nekad je piće popijeno pa obrisano. Razlika se vidi samo iz faze u kojoj se void desio.

### Cilj

Void prati lestvicu iz ADR-044 §4.2: `queued` → tihi zapis · `in_prep` → razlog obavezan · posle `served` → manager odobrenje · posle plaćanja → blok (samo storno/refund tok).

### Implementacija

1. **Nađi sve void puteve**: `grep -rn "void" src/app/api/orders src/lib/orders` + item removal u PATCH ruti — mapa u report (koji putevi postoje: staff dashboard, waiter, POS?).
2. **Faza = station istina**: čitaj `order_station_states` za stavku stanice (ADR-043 S1) — u kojoj je fazi stanica te stavke. Fallback na globalni status za stare porudžbine.
3. **Server-side lestvica** u void putu: razlog (`reason` obavezan string iz UI-ja, min lista predefinisanih + slobodan tekst), manager odobrenje kroz postojeći permission check (ADR-024 — `grep -rn "hasPermission\|requirePermission" src/lib/auth`), blok posle plaćanja sa porukom koja upućuje na storno tok (`src/lib/fiscal/` storno postoji).
4. **UI minimalno**: void dugme u dashboardu dobija reason picker + "traži menadžera" tok — koristi postojeći PIN/override mehanizam ako postoji (`grep -rn "override\|pin" src/lib/auth src/components/dashboard`).
5. Svaki void → S1 journal zapis sa fazom, razlogom, odobrenjem.

### Šta NE raditi

- Ne blokiraj legitimne ispravke pre pripreme — `queued` void ostaje jedan klik.
- Ne diraj storno/fiskalni tok — samo ga referiši kao jedini put posle plaćanja.

### Integracioni check

- [ ] Test po fazi: `queued` prolazi bez razloga · `in_prep` bez razloga = 400 · posle `served` bez odobrenja = 403 · posle plaćanja = blok
- [ ] Void bez station reda (stara porudžbina) — fallback radi, test
- [ ] Svaki void put iz mape pokriven (grep dokaz)
- [ ] Journal zapis sadrži fazu + razlog + odobravaoca
- [ ] Nula novih test failova vs baseline

---

## S3 — Transfer + split/merge invarijante

### Scena iz sale

Porudžbina se seli sa stola 4 na sto 9 posle delimične naplate. Možda legitimno (gosti se preseli), možda trik. Vlasnik hoće: ko, kada, da li je bilo naplate pre, i da se ukupan iznos NIKAD ne promeni seljenjem.

### Cilj

Transfer/split/merge poštuju invarijantu: **total pre = total posle** (blok ako ne). Transfer posle delimične naplate = flag "treba proveru". Sve sa punim tragom.

### Implementacija

1. **Postojeće rute**: `table-transfers/route.ts`, `orders/[orderId]/split/route.ts`, `table-sessions/merge/route.ts` — mapa šta rade i šta već validiraju (prvi korak u report).
2. **Invarijanta totala**: čista funkcija `assertTotalPreserved(before, after)` — poziva se u sve tri rute PRE commita; mismatch ⇒ 409 sa tačnim iznosima ("pre 84.50€, posle 78.50€, razlika 6.00€"). Iznosi su DECIMAL (konvencija projekta).
3. **Risk pravila (flag, ne blok)**: transfer/split POSLE bilo koje naplate na sesiji ⇒ journal zapis sa `risk_flag=true` · oba stola imaju otvoren račun pri transferu ⇒ flag · ista stavka učestvuje u >1 transfera u danu ⇒ flag (dnevni pattern — S7 čita).
4. **Razlog obavezan** za transfer posle naplate (isti pattern kao S2).
5. Svi zapisi kroz S1 helper sa `context` (od/do sto, iznosi pre/posle).

### Šta NE raditi

- Ne redizajn transfer/split UX-a — samo validacija + trag.
- Ne blokiraj transfer posle naplate (legitimno postoji) — flag + razlog.

### Integracioni check

- [ ] Test: split sa "nestalom" stavkom ⇒ 409 sa iznosima
- [ ] Test: merge total očuvan
- [ ] Test: transfer posle naplate ⇒ risk flag + razlog obavezan
- [ ] `grep -rn "assertTotalPreserved" src/` — sve tri rute je zovu
- [ ] Nula novih test failova vs baseline

---

## S4 — Payment guardrails

### Scena iz sale

Najgore noćne more vlasnika: gost naplaćen dvaput (sramota + chargeback) · gost platio a sto zjapi otvoren pa sledeća smena ne zna · sto zatvoren "na reč" a para nema. Ovo mora da hvata sistem, ne pamćenje.

### Cilj

Invarijante iz ADR-044 §4.3 sprovedene: nema duple naplate, nema "paid" ispod balansa, nema zatvorenog stola sa balansom bez razloga, nema paid bez fiscal reference.

### Implementacija

1. **Mapa payment puteva** (prvi korak): online Stripe (`webhook.ts`, `mark-session-paid-online.ts`), keš/kartica na licu mesta (`patch-order-payment-method.ts`?), bill/split rute — tabela u report: put → gde se markira paid → postojeće provere.
2. **Idempotencija naplate**: druga naplata istog računa ⇒ odbij sa jasnom porukom; proveri šta Stripe webhook već garantuje, dodaj server-side proveru za manuelne puteve (paid_at već postavljen + isti iznos ⇒ no-op; različit iznos ⇒ 409 + flag).
3. **Balans provera**: "paid" sa iznosom < open balance ⇒ ili eksplicitno delimično plaćanje (ako tok postoji) ili 409. Nikad tihi "paid".
4. **Zatvaranje stola**: session close sa balansom ≠ 0 ⇒ razlog obavezan (walk-out / comp / greška) + journal flag. Nađi session close tok: `grep -rn "session.*close\|close.*session" src/lib src/app/api`.
5. **Fiscal veza**: paid bez fiskalne reference tamo gde je obavezna ⇒ flag (čitaj postojeći compliance-check — `src/lib/fiscal/compliance-check.ts` — ne dupliraj).
6. **Card failed → paid mismatch**: webhook failed status a order paid ⇒ flag odmah menadžeru (urgent — ovo je aktivan gubitak).

### Šta NE raditi

- Ne diraj Stripe webhook logiku plaćanja — samo dodaj provere/zapise oko markiranja paid.
- Ne blokiraj legitimni walk-out zapis — traži razlog, ne sprečavaj.

### Integracioni check

- [ ] Test: dupla naplata istog računa ⇒ odbijena (idempotencija oba puta — webhook i manuelni)
- [ ] Test: paid < balance ⇒ 409 (ili eksplicitni partial tok)
- [ ] Test: close sa balansom bez razloga ⇒ 400; sa razlogom ⇒ prolazi + flag zapis
- [ ] Test: failed payment + paid order ⇒ urgent flag
- [ ] Mapa payment puteva u reportu — svaki put pokriven
- [ ] Nula novih test failova vs baseline

---

## S5 — Keš rizik + manual override

### Scena iz sale

Kartice ostavljaju trag same. Keš ne. Vlasnik zna gde para najlakše iscuri: keš račun koji dugo stoji otvoren, refund kešom "iz ruke", cena prekucana ručno.

### Cilj

Keš tokovi dobijaju pojačan trag: cash paid bez fiscal reference ⇒ flag · cash refund ⇒ razlog + manager · manual price override ⇒ uvek zapis sa pre/posle cenom · dnevni cash pattern po konobaru (S7 čita).

### Implementacija

1. **Mapa keš toka**: kako se danas markira cash payment (`grep -rn "cash" src/lib/orders src/app/api --type ts`), gde je fiskalni receipt za keš (fiscal spine), postoji li manual price izmena uopšte (`grep -rn "price" src/app/api/orders` — ako ne postoji put, dokumentuj i preskoči taj deo).
2. **Pravila** (server-side, kroz S1 journal + flagovi):
   - cash paid bez fiscal reference gde je lokacija fiskalizovana ⇒ flag
   - cash refund ⇒ razlog + manager permission (S2 pattern)
   - manual price override ⇒ journal zapis `context: {price_before, price_after}` — napomena: price snapshot konvencija projekta znači da se snapshot NE menja retroaktivno; override je nova cena pre porudžbine ili storno+re-order posle — utvrdi šta kod dozvoljava i dokumentuj
   - cash session otvorena > praga (config) posle "hoću da platim" signala ⇒ flag
3. **Dnevni agregati po konobaru** (samo upis, čitanje u S7): cash voidovi, cash refundi, overridi — prosto brojanje iz journala, bez nove tabele ako query može direktno.

### Šta NE raditi

- Ne "no sale" kasa integracija — nemamo fizičku kasu u scope-u; ako POS postoji, samo zabeleži gap.
- Ne menjaj fiskalni tok — čitaj reference, ne piši.

### Integracioni check

- [ ] Mapa keš puteva u reportu (uključujući šta NE postoji)
- [ ] Test: cash refund bez razloga = 400, bez managera = 403
- [ ] Test: cash paid bez fiscal ref (fiskalizovana lokacija) ⇒ flag zapis
- [ ] Journal pokriva sve override puteve koji postoje
- [ ] Nula novih test failova vs baseline

---

## S6 — Popust patterni

### Scena iz sale

Popust od 10% ovde, aperitiv "na kuće" tamo — pojedinačno sitnica. Vlasnik primeti tek kad vidi nedelju: isti konobar, uvek isti sto, uvek posle 22h. Denis broji umesto njega.

### Cilj

Svaki popust ima trag (S1 već upisuje) — ova sesija dodaje **pattern brojanje**: po konobaru, po stolu, po satu, pre/posle naplate; poređenje sa prosekom lokacije (ne apsolutni prag).

### Implementacija

1. **Mapa popust puteva**: promo kod (`validate-promo.ts`) vs ručni popust osoblja — postoji li drugi uopšte? (`grep -rn "discount" src/app/api src/lib/orders`). Ako ručni popust ne postoji kao feature, scope = promo + comp stavke; dokumentuj.
2. **Pattern agregacija** (čista funkcija + query nad S1 journalom): popusti po staff_id za dan/nedelju → odstupanje od proseka lokacije > praga (config `ops.lossPrevention.discountDeviation`) ⇒ pattern flag u S7 report. NE realtime notifikacija.
3. **Popust posle naplate** = tvrdi flag odmah (to je refund maskiran u popust).
4. Sve poređenje **relativno** (konobar vs prosek smene/lokacije) — ADR-044 §4.6.

### Šta NE raditi

- Ne score "poštenja" konobara, ne rang lista osoblja — samo odstupanja sa brojkama.
- Ne realtime alarmi za pojedinačni popust — patterni idu u dnevni report.

### Integracioni check

- [ ] Test pattern funkcije: konobar 3× iznad proseka ⇒ flag; ceo tim daje popuste (happy hour) ⇒ NEMA flaga
- [ ] Test: popust posle naplate ⇒ tvrdi flag
- [ ] Mapa popust puteva u reportu
- [ ] Nula novih test failova vs baseline

---

## S7 — Owner suspicious report + Operations Center sekcija

### Scena iz sale

Vlasnik uveče neće roman — hoće listu: "3 stvari za proveru danas. Prva: void 2× Aperol posle served, razlog nije unet, 21:14, sto 6." Klik → timeline → sam presudi.

### Cilj

Dnevni suspicious digest vlasniku (proširenje daily reporta) + "Za proveru" sekcija u Operations Centru (ADR-043 S4) — samo za `audit.suspicious.view` permission. Svaki flag ima ishod: proveren-u redu / proveren-problem / otvoren.

### Implementacija

1. **Permission**: dodaj `audit.suspicious.view` u permission katalog (ADR-024 pattern — `src/lib/auth/permission-catalog.ts`), default samo owner/manager.
2. **Digest**: nova sekcija u `buildDailyReport` — flagovi dana grupisani po tipu (voidovi po fazi, transferi sa rizikom, payment mismatch, cash flagovi, popust patterni), svaki sa ko/kad/sto/iznos + link na order timeline. Prag: max N stavki, ostalo "još X u dashboardu" — lista, ne roman.
3. **Operations Center sekcija "Za proveru"**: čita otvorene flagove iz journala; kartica → akcija (ADR-043 S4 pravilo): "Pogledaj timeline" + "Označi: u redu" / "Označi: problem" (ishod se upisuje uz flag — resolve mehanizam, isti pattern kao notification read).
4. **Ton**: svaki tekst flaga generiše čista funkcija — formulacija "treba proveru", nikad optužba (test na formulacije).
5. Flag bez ishoda stariji od X dana ⇒ pojavljuje se u narednom digestu ponovo (ništa ne nestaje tiho).

### Šta NE raditi

- Ne poseban mail/kanal — postojeća daily report dostava.
- Ne prikaz flagova osoblju bez permission-a (ni u notifikacijama).

### Integracioni check

- [ ] Permission postoji i gate-uje i digest sekciju i Ops Center sekciju (test/grep)
- [ ] Test: flag → ishod → nestaje iz otvorenih; bez ishoda → vraća se u digest
- [ ] Test formulacija: nijedan generisani tekst ne sadrži optužujuće formulacije (lista zabranjenih reči)
- [ ] Digest max N stavki (test sa 50 flagova)
- [ ] `grep -rn "buildDailyReport" src/` — svi potrošači rade
- [ ] Nula novih test failova vs baseline

---

## S8 — Pilot + E2E verifikacija

### Cilj

Ceo lanac dokazan: nelogična akcija → zapis → flag → vlasnik vidi → ishod. Verifikaciona sesija — kod se menja samo za trivijalne bugfixove.

### Scenario walk-through (svaki korak sa dokazom)

1. Void posle `served` bez razloga ⇒ 400; sa razlogom + manager ⇒ prolazi + journal zapis
2. Split koji "izgubi" 6€ ⇒ 409 sa iznosima
3. Transfer posle naplate ⇒ prolazi uz razlog + risk flag
4. Dupla naplata ⇒ odbijena oba puta (webhook + manuelni)
5. Session close sa balansom ⇒ razlog obavezan + flag
6. Popust pattern (mock nedelja) ⇒ flag u digestu, happy-hour scenario ⇒ bez flaga
7. Sve gore ⇒ Owner digest lista + Ops Center "Za proveru" sa akcijama
8. Flag → "proveren: u redu" ⇒ zatvoren; drugi flag bez ishoda ⇒ vraća se sutra
9. Konobar NIGDE ne vidi flagove (permission test)
10. **Regresija**: `pnpm test:run` (baseline), `type-check`, `lint`, `build`, `eval:denis`

**Go kriterijum:** nijedan flag ne nestaje bez ishoda · nijedan blok ne sprečava legitimnu operaciju iz scenarija · ton čist u svakoj poruci.

---

## Session report šablon

Isti kao ADR-043 (vidi tamo) + obavezan red: **"Ton proveren: nijedna formulacija ne optužuje ✓"**.

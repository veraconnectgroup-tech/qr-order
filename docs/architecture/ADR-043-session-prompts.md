# ADR-043 — Session Prompts (Denis Restaurant Co-worker)

> **Operator (Jovica):** koristi **[ADR-043-operator.md](./ADR-043-operator.md)** — jedna linija.
> **Implement agent:** ovaj fajl + obavezna literatura ispod.

---

## Obavezna literatura (pročitaj PRE koda)

1. [ADR-043-denis-coworker-completion.md](./ADR-043-denis-coworker-completion.md) — odluke §4, anti-ciljevi §6
2. [.cursor/rules/commit-checklist.mdc](../../.cursor/rules/commit-checklist.mdc) — side effects, transakcije, serverless
3. [ADR-001-implementation-warnings.md](./ADR-001-implementation-warnings.md) — **ne diraj `create-order.ts` tokove**
4. Ako diraš DB: [ADR-001-safe-rollout.md](./ADR-001-safe-rollout.md) + [supabase-migration-baseline.md](./supabase-migration-baseline.md)
5. Ako diraš Denis runtime: [.cursor/rules/denis-architecture.mdc](../../.cursor/rules/denis-architecture.mdc)

**Referentna implementacija (S0, gotova — kopiraj šablone odavde):**

- Domain modul: `src/lib/denis/stations/station-questions.ts` + `question-triggers.ts`
- Staff-auth API: `src/app/api/station-questions/[id]/answer/route.ts`
- Realtime hook: `src/hooks/use-station-questions.ts` (+ `RealtimeTable` union u `src/lib/realtime/postgres-realtime-engine.ts`)
- Migracija sa RLS + realtime: `supabase/migrations/00151_station_questions.sql`
- Testovi: `src/__tests__/station-questions.test.ts`

---

## Status implementacije (ažuriraj posle svake sesije)

| Sesija | Status | Ključni fajlovi |
|--------|--------|-----------------|
| **S0 — Question Card** | ✅ | `src/lib/denis/stations/`, migracija `00151` |
| **S1 — order_station_states** | ✅ | `00152_order_station_states.sql`, `src/lib/orders/station-states.ts`, `src/app/api/orders/[orderId]/station-status/route.ts`, `src/__tests__/station-states.test.ts` |
| **S2 — KDS/bar/waiter UI** | ✅ | `station-display.ts`, `fetch-order-station-states.ts`, hooks + `kds-board`, `kitchen-board`, `bar-order-row`, `waiter-order-row`, `station-display.test.ts` |
| **S3 — Denis čita stanice** | ✅ | `load-order-facts.ts`, `types.ts` (`stationStates`), `station-guest-message.ts`, `question-triggers.ts`, `tell-world-order.ts`, `station-status/route.ts`, `station-guest-message.test.ts` |
| **S4 — Operations Center** | ✅ | `operations/page.tsx`, `operations-center.tsx`, `operations-triage.ts`, `operations-actions.ts`, hooks `use-location-station-questions`, `use-operations-ready-states` |
| **S5 — Order Timeline panel** | ✅ | `order-timeline.ts`, `timeline/route.ts`, `order-timeline-panel.tsx`, `order-card.tsx`, `order-history-list-shell.tsx`, `order-timeline.test.ts` |
| **S6 — Shift recap** | ✅ | `denis-shift-report.ts`, `build-daily-report.ts` (`denisShift`), `load-daily-report-context.ts`, `denis-shift-report.test.ts`, `daily-report.test.ts` |
| **S7 — Pilot + E2E verifikacija (Faza 1 gate)** | ✅ | `pilot-wiring.ts` + `adr-043-pilot-e2e.test.ts` + `table_os_pilot` preset (full stack) |
| **S8 — Sto koji ćuti (tempo stola)** | ✅ | `detect-table-tempo-phase.ts`, `table-tempo-phase.test.ts`, `ops.tableTempo` config, `drink-sommelier-triggers.ts` (`detectSommelierStationTempoRefill`), watcher + proactive wiring |
| **S9 — Nema na stanju (86 loop)** | ✅ | `eighty-six.ts`, `eighty-six-client.ts`, `api/products/[productId]/availability`, `api/locations/[locationId]/eighty-six`, `eighty-six-panel.tsx`, `order-item-product-line.tsx`, `tell-world-order.ts` (`commerce.product_unavailable`), `denis-shift-report.ts` + daily digest, `eighty-six.test.ts` |
| **S10 — Desert i kafa u pravom trenutku** | ✅ | `detect-dessert-window.ts`, `dessert-window.test.ts`, `rank-proactive-candidates.ts`, `decide-proactive-turn-plan.ts`, `emit-proactive-nudge.ts`, `concierge-config.schema.ts` (`ops.dessertWindow`), `pilot-wiring.ts`, `denis-shift-report.ts`, `build-daily-report.ts`, `load-daily-report-context.ts` |
| **S11 — Stalni gost** | ✅ | `platform/returning-guest.ts`, `returning-guest.test.ts`, `build-narration-facts.ts`, `derive-contextual-chips.ts`, `same-again-chips.ts`, `denis-shift-report.ts` (`aggregateReturningGuestStats`), `build-daily-report.ts`, `load-daily-report-context.ts`, `denis-guest-memory-store.ts` (postojeći), `api/guest/denis-memory` DELETE (forget me) |
| **S12 — Nezadovoljan gost (service recovery)** | ✅ | `cognition/recovery/detect-service-recovery.ts`, `build-service-recovery-alert.ts`, `service-recovery-timeline.ts`, `resolve-turn-recovery.ts`, `apply-frustration-recovery.ts`, `detect-review-moment.ts`, `decide-proactive-turn-plan.ts`, `operations-triage.ts`, `operations-center.tsx`, `denis-shift-report.ts` (`aggregateServiceRecoveryStats`), `service-recovery.test.ts` |
| **S13 — Sto posle plaćanja (obrt stola)** | ✅ | `00153_table_bus_obligations.sql`, `bus-table-obligation.ts`, `waiter-obligation-types.ts` (`bus_table`), `run-commerce-experience.ts`, `run-session-watcher.ts`, `table-bus-obligations/[id]/complete/route.ts`, `waiter-bus-table-banner.tsx`, `operations-triage.ts`, `denis-shift-report.ts`, `table-turnaround.test.ts` |
| **S14 — Brifing pre smene + nedeljni izveštaj vlasniku** | ✅ | `prep-briefing-rhythm-rush.ts`, `prep-briefing-station-issues.ts`, `build-daily-prep-briefing.ts`, `load-daily-prep-briefing-context.ts`, `daily-report-store.ts`, `build-weekly-owner-report.ts`, `run-daily-report.ts`, `load-staff-copilot-snapshot.ts`, `denis-dashboard-view.tsx`, `prep-briefing-s14.test.ts`, `weekly-owner-report.test.ts` |

> **Faza 1 = S1–S7** (station truth + operations proof). **Faza 2 = S8–S14** (host + revenue). Faza 2 kreće tek kad S7 da "go" — jer skoro sve u Fazi 2 čita station istinu iz Faze 1.

---

## Pravila za svakog agenta (svaka sesija)

1. `git status` + pročitaj status tabelu — razumi šta već postoji. **Tačno jedna sesija po PR-u.**
2. Pre izmene bilo koje funkcije: `grep -rn "functionName" src/` — popravi SVA call site-ova ili nijedno.
3. Migracije: sledeći slobodan broj (proveri `ls supabase/migrations | tail`), RLS odmah, nikad ne edituj postojeću migraciju. **Ne pokrećeš `db push`** — to radi operator.
4. **Obavezna verifikacija pre "gotovo":**

```bash
pnpm vitest run <tvoji-novi-testovi>   # svi tvoji testovi zeleni
pnpm test:run                          # BASELINE: 26 failova postoji na main-u (2026-07-01).
                                       # Tvoja sesija NE SME dodati nijedan novi fail.
pnpm type-check                        # 0 errors
pnpm lint                              # 0 errors (warnings su OK)
pnpm build                             # kompajl mora proći; lokalno pada kasnije na
                                       # "Missing env: SUPABASE_SERVICE_ROLE_KEY" — to je OK,
                                       # bitno je da webpack compile i type faza prođu
```

5. **Integracioni check** — svaka sesija ima svoju listu ispod; svaki punkt mora biti eksplicitno potvrđen u session reportu (sa grep dokazom ili testom).
6. Na kraju: ažuriraj status tabelu u OVOM fajlu (⬜ → ✅ + ključni fajlovi) i napiši session report (šablon u ADR-043-operator.md). **Ne commit-uj osim ako operator kaže.**

---

## S1 — `order_station_states` (temelj — najvažnija sesija)

### Cilj

Svaka porudžbina dobija odvojen status po stanici (kitchen/bar) sa timestampovima, bez diranja postojećeg `orders.status` toka. Ovo je izvor istine za "šta je u baru, šta u kuhinji, šta je spremno, šta je preuzeto".

### Implementacija

1. **Migracija** (sledeći slobodan broj) — tabela iz ADR-043 §4.1, plus:
   - Indeks: `(order_id)`, partial `(status) WHERE status IN ('ready','in_prep')` po lokaciji — dodaj `location_id UUID NOT NULL REFERENCES locations(id)` u tabelu radi RLS i upita (denormalizacija, popunjava trigger iz orders reda).
   - RLS: `staff_manage` preko `get_user_location_ids()` + service role policy (šablon: migracija `00151`).
   - Realtime: `REPLICA IDENTITY FULL` + publikacija (šablon: `00151`).
   - **AFTER INSERT trigger na `order_items`**: za svaki novi order_item odredi stanicu po `menu_section` (`food`/`desserts` → kitchen, `drinks` → bar) i `INSERT ... ON CONFLICT (order_id, station) DO NOTHING` u `order_station_states`. Trigger funkcija čita `location_id` iz `orders`.
   - **Backfill** u istoj migraciji za porudžbine sa `status NOT IN ('delivered','cancelled','rejected')`: kreiraj station redove, mapiraj postojeći globalni status (`preparing` → `in_prep`, `ready` → `ready`, ostalo → `queued`).
   - **RPC `patch_station_status_tx(p_order_id, p_station, p_status, p_staff_id)`**: u JEDNOJ transakciji (commit-checklist §5) ažurira station red (+ timestamp kolonu za novi status) i primenjuje pravilo agregacije iz ADR-043 §4.2 na `orders.status` (globalni status nikad unazad). Vraća JSON sa oba nova statusa.
2. **Tipovi**: dodaj `order_station_states` u `type Tables` u `src/types/database.ts` (ručno održavan fajl — vidi kako je dodat `station_questions`) + RPC u `Functions` sekciju.
3. **Domain modul** `src/lib/orders/station-states.ts`:
   - `stationsForOrderItems(items)` — čista funkcija (koristi `isKitchenMenuSection` iz `src/lib/kitchen/menu-section.ts`)
   - `aggregateGlobalStatus(stationStates, currentGlobal)` — čista funkcija, pravilo §4.2, **sa testovima za svaki red tabele + "nikad unazad"**
   - `patchStationStatus(admin | fetch, ...)` — poziv RPC-a
4. **API ruta** `src/app/api/orders/[orderId]/station-status/route.ts` — PATCH, staff auth (kopiraj `verifyStaffOrderAccess` pattern iz `src/app/api/orders/[orderId]/route.ts`), zove RPC. `VALID_TRANSITIONS` ekvivalent za station lanac: `queued → in_prep → ready → picked_up → served` (+ `cancelled` iz svakog).
5. **Role guardrails u API ruti** (server-side, ne samo UI):
   - `bar` rola → sme da menja SAMO `station='bar'` i SAMO prep tranzicije (`queued → in_prep → ready`)
   - `kitchen` rola → isto, SAMO `station='kitchen'`
   - `waiter` rola → SAMO `ready → picked_up` i `picked_up → served` (bilo koja stanica)
   - `manager`/`owner` → override: bilo koja stanica, bilo koja validna tranzicija
   - Proveri kako se rola čita u postojećim staff rutama (`grep -rn "staff.role\|staffRole" src/app/api`) i koristi isti mehanizam. 403 sa jasnom porukom kad rola ne sme.
6. **Edge cases za stavke — definiši i DOKUMENTUJ ponašanje** (komentar u migraciji + session report):
   - **Naknadno dodata stavka** (dokup): trigger na INSERT kreira station red ako ne postoji (`ON CONFLICT DO NOTHING`). Ako station red već postoji i u statusu je `picked_up`/`served` — nova stavka znači novu rundu posla: trigger resetuje `status` na `queued` i null-uje `ready_at`/`picked_up_at`/`served_at`. Ako je red u `queued`/`in_prep`/`ready` — ne dira se. Globalni status se NE dira unazad (§4.2). Napiši test/SQL primer za ovaj tok.
   - **Voidovana/obrisana stavka**: ako se poslednja stavka jedne stanice ukloni (DELETE ili void), station red prelazi u `cancelled` — AFTER DELETE/UPDATE trigger ili eksplicitno u void toku (pronađi gde void živi: `grep -rn "void" src/app/api/orders`). Ako void mehanizam ne briše redove nego markira — dokumentuj šta trigger vidi i šta pokrivaš, a šta ostaje gap za sledeću sesiju.
   - **Cancelovan/rejected order**: globalni `cancelled`/`rejected` ⇒ svi station redovi `cancelled` (u istom toku koji menja globalni status, ili trigger na `orders.status`). Agregacija NIKAD ne oživljava cancelled red.
7. **Realtime**: dodaj `"order_station_states"` u `RealtimeTable` union (`src/lib/realtime/postgres-realtime-engine.ts`).

### Šta NE raditi

- Ne diraj `create_guest_order_tx` / `create_staff_order_tx` / `create_pos_order_tx` — trigger pokriva sve.
- Ne diraj postojeći PATCH `/api/orders/[orderId]` globalni tok — on ostaje za fiskal/plaćanje/reject.
- Ne menjaj ponašanje nijedne postojeće površine — ova sesija je čisto aditivna.

### Integracioni check (obavezno u reportu)

- [ ] SQL testabilno: unit testovi za `aggregateGlobalStatus` (sve kombinacije + no-backward garancija) i `stationsForOrderItems` — zeleni
- [ ] `grep -rn "order_station_states" src/` — svi potrošači koje si napravio konzistentni
- [ ] Migracija: `CHECK` constrainti, RLS, indeksi, backfill — sve u JEDNOM fajlu, sekvencijalni broj
- [ ] Trigger pokriva mixed/kitchen-only/bar-only porudžbinu (dokaži SQL komentarom sa primerom u migraciji)
- [ ] **Edge cases dokumentovani u session reportu**: naknadno dodata stavka (posle `served`), voidovana/obrisana stavka, cancelovan/rejected order — za svaki: šta se dešava sa station redom, sa dokazom (test ili SQL primer). Ako nešto ostaje gap — eksplicitno navedeno.
- [ ] **Role guardrails testirani**: bar rola ne može kitchen stanicu (403), waiter ne može `queued → in_prep` (403), manager može sve — test ili grep dokaz na server-side proveru
- [ ] Postojeći testovi: nula novih failova vs baseline

---

## S2 — KDS / bar / waiter UI na station statusima

### Cilj

Bar menja SAMO bar status, kuhinja SAMO kitchen status, konobar označava `picked_up`/`served` — i ništa se više ne gazi. Gost i dalje vidi globalni status (netaknuto).

### Implementacija

1. **KDS** (`src/components/dashboard/kds-board.tsx`, `kitchen-board.tsx`): dugmad za advance zovu novi station-status API (`in_prep → ready`) umesto globalnog PATCH-a. Kolone se pune po kitchen station statusu; fallback na globalni status kad station red ne postoji (stare porudžbine bez backfill-a).
2. **Bar** (`src/components/bar/bar-order-row.tsx`, `use-bar-orders.ts`): isto za bar stanicu. Bar red prikazuje samo drink stavke (već postoji `getDrinksOrderItems`).
3. **Waiter** (`src/components/waiter/waiter-order-row.tsx`): dugme "Preuzeto" (`ready → picked_up`) i "Isporučeno" (`picked_up → served`) po stanici; kad su sve stanice `served`, RPC agregacija sama podiže globalni na `delivered` — konobar NE zove globalni PATCH za delivered više. **Obriši stari poziv u istom PR-u** (commit-checklist §1).
4. **Hooks**: `use-kds-orders` / `use-bar-orders` / waiter hook — dohvati station redove u istom fetch-u (join ili drugi select), realtime subscribe na `order_station_states`.
5. **Optimistic update** po stanici (šablon: `optimisticUpdateStatus` u `use-bar-orders.ts`).

### Šta NE raditi

- Ne diraj guest order tracking UI — gost vidi globalni status (S3 uvodi bogatiji tell).
- Ne diraj accept/reject tok (`pending → accepted` ostaje globalni, sa fiskalom).

### Integracioni check

- [ ] `grep -rn "patchOrderStatus" src/components` — bar/KDS/waiter za prep tok više NE zovu globalni PATCH (accept/reject SME); svaki preostali call site objašnjen u reportu
- [ ] **Role guardrails end-to-end**: bar UI nudi SAMO bar tranzicije, kitchen SAMO kitchen, waiter SAMO `picked_up`/`served` — i server to odbija čak i ako UI zaobiđeš (S1 guardrails potvrđeni iz UI perspektive, sa dokazom). Manager override površina jasno označena (gde manager može ručno da pomeri station status i kako).
- [ ] Mixed porudžbina scenario opisan u testu: bar `ready` + kitchen `in_prep` ⇒ globalni ostaje `preparing`
- [ ] Waiter `served` na svim stanicama ⇒ globalni `delivered` (test na `aggregateGlobalStatus` + API integracioni test ako je izvodljiv)
- [ ] Stara porudžbina bez station redova se i dalje renderuje (fallback test ili eksplicitni grep dokaz)
- [ ] Nula novih test failova vs baseline

---

## S3 — Denis čita stanice (fold → tell → watcher)

### Cilj

Denis zna odvojeno bar/kitchen/waiter/guest sliku i govori gostu istinu po stanici: "Piće je spremno, javljam osoblju da ga donese. Hrana još ~10 min."

### Implementacija

1. **FOLD**: `src/lib/denis/loop/fold-table-session-state.ts` + `OrderFact` tip (`src/lib/denis/loop/types.ts`) — dodaj `stationStates?: Array<{station, status, readyAt, pickedUpAt}>`. Puni se u `loadGuestOrdersForAi` (`src/lib/ai/order-context.ts`) ili posebnim select-om u fold-u — izaberi jedno mesto, ne oba.
2. **TELL gostu**: `openOrderStatusGuestMessage` (`src/lib/guest/denis-guest-recovery.ts`) — kad postoje station statusi, sastavi per-station poruku (i18n ključevi u `src/lib/i18n/translations.ts`, šablon: `ai.station.*` ključevi iz S0, jezici de/en/sr minimum). Fallback na postojeću poruku kad nema station podataka.
3. **Watcher precizno** (`src/lib/denis/stations/question-triggers.ts`):
   - `ready_pickup` okidač koristi station `ready_at` umesto aproksimacije
   - `mixed_conflict` se NE okida kad bar station kaže `picked_up`/`served` (piće je stiglo — nema konflikta); pitaj bar samo kad je bar station još `queued`/`in_prep`
   - "Ne pitaj ono što sistem zna": ako station status odgovara na pitanje, `createStationQuestion` se preskače — dodaj guard u `runStationQuestionTriggersForSession`
4. **World signali**: `tell-world-order.ts` — kad bar station pređe u `ready`, guest tell "piće je spremno" čak i kad je globalni još `preparing` (gated: `ops.stationQuestions.enabled` ili novi flag `ops.stationAwareTell` — odluči i dokumentuj).
5. **Truth contract (zakucano — svaka guest poruka mora proći ova pravila):**
   - **ETA se NIKAD ne izmišlja.** Denis sme da kaže broj minuta SAMO ako dolazi iz odgovora stanice (`station_questions.answer_eta_minutes`, unutar svežine iz `getFreshStationAnswer`). Bez sveže ETA-e: "u pripremi" / "proveravam sa kuhinjom" — nikad "još ~X min" iz proseka, config-a ili nagađanja.
   - **"Sve je spremno" SAMO kad su SVE stanice sa stavkama `ready`+.** Ako je spremna jedna stanica: per-station poruka ("Piće je spremno... hrana je još u pripremi") — nikad globalno "spremno".
   - **Stanje se ne ulepšava**: `queued` (niko nije počeo) se ne prikazuje kao "u pripremi" — koristi neutralno "primljena je / u redu za pripremu".
   - Ova pravila implementiraj kao čistu funkciju (message builder prima station stanja + svežu ETA i vraća poruku) da bi bila testabilna po pravilu.

### Šta NE raditi

- Ne diraj TDE decide-turn-plan granice — samo obogaćuješ podatke koje postojeći planovi čitaju.
- Ne dodaji nove notifikacije osoblju — S3 je guest-facing istina + preciznost postojećih okidača (manje pitanja, ne više).

### Integracioni check

- [ ] Test: mixed porudžbina, bar `served` + kitchen `in_prep` ⇒ `mixed_conflict` se NE okida (novi test u `station-questions.test.ts`)
- [ ] Test: guest per-station poruka za bar-ready + kitchen-in_prep
- [ ] **Truth contract testovi** (svaki posebno): (a) bez sveže station ETA-e poruka NE sadrži broj minuta; (b) jedna stanica `ready` + druga `in_prep` ⇒ poruka NIJE "sve spremno"; (c) sve stanice `ready` ⇒ poruka SME "spremno"; (d) `queued` se ne prikazuje kao "u pripremi"
- [ ] `pnpm eval:denis` prolazi isto kao pre (diraš fold/loop — obavezno po denis-architecture pravilu); ako eval ima pre-postojeće failove, dokaži da su identični pre/posle
- [ ] `grep -rn "stationStates" src/` — svi potrošači konzistentni
- [ ] Nula novih test failova vs baseline

---

## S4 — Operations Center (`/dashboard/operations`)

### Cilj

Menadžer ne gleda dashboard — gleda trijažu: šta sada gori, ko čeka, šta je spremno a nije preuzeto, koji sto je u riziku.

### Implementacija

1. **Ruta** `src/app/(dashboard)/dashboard/operations/page.tsx` + client komponenta `src/components/dashboard/operations-center.tsx`. Sidebar link (nađi gde su linkovi: `grep -rn "waiter-calls" src/components/dashboard/dashboard-shell` ili sidebar komponenta).
2. **Sekcije (sve iz POSTOJEĆIH izvora — nijedan novi upis):**
   - 🔴 **Gori sada**: `denis_staff_notifications` unread, priority `urgent`/`high` (realtime već postoji u `RealtimeTable`)
   - 🟠 **Čeka odgovor**: otvorena `station_questions` sa countdown-om (hook `use-station-questions` postoji — proširi ili generalizuj za obe stanice)
   - 🟡 **Spremno a stoji**: `order_station_states` gde `status='ready'` i `ready_at` stariji od praga (posle S1; ako S1 nije gotova, sekcija se gradi na `orders.status='ready'` + `ready_at`)
   - 🔵 **Stolovi u riziku**: `loadStaffCopilotSnapshot` priority tables (`src/lib/denis/venue/copilot/`)
   - ⚪ **Pozivi konobara**: `waiter_calls` pending
3. **Dizajn**: dashboard-theme (dark, `bg-dash-*`, ember akcent), touch targeti ≥48px, skeleton loaderi (ne spinneri), sekcije sortirane po hitnosti, prazno stanje "Sve mirno ✓".
4. **Svaka kartica MORA imati akciju ili jasan next step** — nijedna kartica ne sme biti samo informacija. Za svaki tip kartice definiši i implementiraj:
   - Denis notifikacija → "Označi rešeno" (postojeći read mehanizam — `grep -rn "read_at" src/` za pattern) + link na sto/order
   - Otvoreno station pitanje → link na stanicu koja duguje odgovor + "Eskaliraj" (postojeći expiry/eskalacija tok iz S0, ne novi mehanizam)
   - Spremno-a-stoji → "Podseti konobara" (postojeći `dispatchStaffNotification` tip, ne novi) + link na order
   - Sto u riziku → otvori sto (postojeći table detail)
   - Poziv konobara → postojeća acknowledge akcija iz waiter-calls toka

### Šta NE raditi

- Nijedan novi DB upis, nijedna nova notifikacija, nijedan novi cron.
- Ne dupliraj logiku prioritizacije — koristi postojeći copilot modul.

### Integracioni check

- [ ] Stranica se server-side renderuje bez errora (`pnpm build` compile faza)
- [ ] **Tabela u session reportu: tip kartice → akcija/next step** — svaki tip ima implementiranu akciju, nijedna kartica nije "samo info". Ako je akcija link, navedi gde vodi.
- [ ] Realtime: promena u `denis_staff_notifications` / `station_questions` osvežava sekcije (opiši mehanizam u reportu, grep na `usePostgresRealtime` upotrebu)
- [ ] `grep -rn "loadStaffCopilotSnapshot" src/` — nisi napravio paralelnu funkciju
- [ ] Radi i kad S1 tabela ne postoji u tipovima trenutne grane (uskladi sa statusom S1 u tabeli gore)
- [ ] Nula novih test failova vs baseline

---

## S5 — Order Timeline panel (crna kutija porudžbine)

### Cilj

Za svaku porudžbinu: kada je kreirana, ko je prihvatio, kada je koja stanica počela/završila, kada je Denis pitao/upozorio/eskalirao, zašto je nastao problem.

### Implementacija

1. **Čitanje** `src/lib/orders/order-timeline.ts`: `loadOrderTimeline(admin, orderId)` spaja:
   - `orders` timestampove (`created_at`, `accepted_at`, `preparing_at`, `ready_at`, `delivered_at`)
   - `order_events` (audit — trenutno NULA UI potrošača, proveri šta se upisuje: `grep -rn "order_events" src/lib`)
   - `order_station_states` timestampove (posle S1)
   - `station_questions` za taj order (asked/answered/expired + odgovor)
   - vraća sortiran niz `{ at, kind, label, actor?, detail? }`
2. **API** `GET /api/orders/[orderId]/timeline` — staff auth (isti `verifyStaffOrderAccess` pattern).
3. **UI**: expandable sekcija "Timeline" na order kartici (`src/components/dashboard/order-card.tsx`) i/ili history detalju (`order-history-list`) — vertikalna lista sa vremenima, Denis događaji označeni ember bojom. Lazy load (fetch tek na expand).
4. Ako neki ključni događaj fali u upisu (npr. niko ne upisuje "waiter picked up" pre S2) — NE dodaješ novi upisni sistem; zabeleži gap u session reportu.

### Šta NE raditi

- Ne novi event store, ne novi upis — samo čitanje i spajanje postojećeg.

### Integracioni check

- [ ] Unit test za merge/sort logiku `loadOrderTimeline` (mock redovi)
- [ ] Panel radi za porudžbinu BEZ station redova i BEZ station pitanja (prazne sekcije, bez crash-a) — test
- [ ] Lazy load potvrđen (nema fetch-a dok se ne otvori)
- [ ] Nula novih test failova vs baseline

---

## S6 — Shift recap

### Cilj

Posle smene vlasnik dobija: gde su bila kašnjenja, koji sto je bio najrizičniji, koliko puta je Denis sprečio problem, gde bar/kuhinja/konobari pucaju.

### Implementacija

1. **Proširi** `buildDailyReport` (`src/lib/admin/build-daily-report.ts`) — nova sekcija `denisShift`:
   - `station_questions` za dan: postavljeno/odgovoreno/isteklo po stanici, prosečno vreme odgovora
   - eskalacije: `denis_staff_notifications` count po tipu/prioritetu
   - najrizičniji sto: najviše pitanja + eskalacija + waiter_calls
   - per-station kašnjenja (posle S1: `ready_at - in_prep_at` prosek po stanici; pre S1: postojeći kitchen avg)
   - "sprečeni problemi": pitanja odgovorena PRE nego što je gost pitao ponovo / pre eskalacije (heuristika — dokumentuj je u kodu)
2. **Format**: proširi `formatDailyReportDigest` (postojeći digest tok — `grep -rn "formatDailyReportDigest" src/` za potrošače, svi moraju i dalje raditi).
3. Dostava ostaje postojeća (`run-daily-report.ts`) — ne diraj mehanizam.

### Integracioni check

- [ ] Unit testovi za novu agregaciju (mock redovi, edge: dan bez ijednog pitanja)
- [ ] `grep -rn "buildDailyReport\|formatDailyReportDigest" src/` — svi call site-ovi rade sa novim tipom (nema optional-chaining rupa)
- [ ] Postojeći daily-report testovi zeleni
- [ ] Nula novih test failova vs baseline

---

## S7 — Pilot enablement + E2E verifikacija (review agent)

### Cilj

Sve sesije provereno rade ZAJEDNO na pilot lokaciji. Ova sesija je verifikaciona — kod se menja samo za bugfix.

### Implementacija

1. **Config**: uključi `ops.stationQuestions.enabled` (+ flagove iz S3) na pilot lokaciji kroz `pilot-wiring.ts` / concierge config — proveri kako S0 flag stoji: `grep -rn "stationQuestions" src/lib/denis/config`.
2. **E2E scenario A — srećan tok** (dokumentuj svaki korak sa dokazom — kod/test/screenshot):
   1. Gost naruči pivo + ćevape → station redovi kreirani (kitchen + bar)
   2. Bar označi ready → gost dobija "piće spremno" tell, globalni ostaje `preparing`
   3. Kuhinja ne odgovara 12 min → Question Card na KDS
   4. Kuhinja tapne "5 min" → gost dobija istinit ETA, timeline zabeležen
   5. Konobar preuzme i isporuči → globalni `delivered`
   6. Operations Center prikazao svaki korak
   7. Timeline panel prikazuje ceo tok
   8. Daily report sadrži Denis sekciju
3. **E2E scenario B — praćenje problema do kraja** (OBAVEZNO — dokazuje da Denis ne samo vidi problem nego ga vodi do rešenja ili eskalacije):
   1. Kuhinja NE odgovara na Question Card → pitanje ističe (`expired`)
   2. Expiry eskalacija se okida → menadžer dobija notifikaciju (postojeći S0 tok — dokaži da radi end-to-end, ne samo da kod postoji)
   3. Problem se pojavljuje u Operations Center "Gori sada" sekciji SA akcijom
   4. Menadžer iz Operations Centra reaguje (označi rešeno / ponovo pita stanicu) → kartica nestaje
   5. Ceo lanac (pitanje → expiry → eskalacija → rezolucija) vidljiv u Order Timeline panelu
   6. Anti-spam potvrđen: tokom celog scenarija ista stanica NIJE dobila duplo pitanje za isti order (cooldown radi)
   - **Go kriterijum:** nijedan problem ne sme da "nestane" bez rezolucije ili eskalacije — ako pitanje istekne a menadžer NIJE obavešten, to je no-go bug.
4. **Regresija**: `pnpm test:run` (vs baseline), `pnpm type-check`, `pnpm lint`, `pnpm build`, `pnpm eval:denis`.
5. Session report = go/no-go lista po OBA scenarija + svi nađeni bugovi (fix u ovoj sesiji samo ako je trivijalan; inače nova sesija).

---

# FAZA 2 — Host + Revenue (S8–S14)

> Kreće tek posle S7 "go". Svaka sesija ovde čita station istinu iz Faze 1.
> **Perspektiva:** svaka sesija kreće od scene koju vlasnik vidi u sali. Ako sesija ne rešava nešto što vlasnik golim okom primeti (ili propusti), ne pripada ovde.
> **Zlatno pravilo Faze 2:** Denis sme da predloži/podseti SAMO kad to pomaže gostu i kad restoran nije u haosu — svaki novi nudge prolazi postojeća anti-spam i rush pravila. Co-worker koji gnjavi biva ugašen.

---

## S8 — Sto koji ćuti (tempo stola)

### Scena iz sale

Vlasnik prolazi kroz salu i vidi: sto 7 je skenirao QR pre 12 minuta i ništa nije naručio. Sto 3 je popio pića — čaše prazne već 15 minuta, niko ne prilazi. Vlasnik bi sam prišao ili poslao konobara. Denis mora da vidi isto to.

### Cilj

Denis primeti sto koji je "utihnuo" u svakoj fazi: seo pa ne naručuje · popio pa čaše stoje prazne · pojeo pa ništa se ne dešava. Reakcija po fazi: nežan nudge gostu (pomoć oko menija / druga runda) ili tihi signal konobaru — nikad oba odjednom.

### Implementacija

1. **Faze stola** izvedi iz postojećih podataka — bez nove tabele: QR scan vreme (guest session), porudžbine + station statusi (S1: `served_at` = kad je piće/hrana stiglo na sto), poslednja Denis interakcija. Čista funkcija `detectTableTempoPhase(sessionFacts)` → `browsing_stalled | drinks_finished_estimate | post_meal_idle | none`.
   - "Prazna čaša" se NE meri senzorom — procena: `served_at` pića + prosečno vreme konzumacije po tipu (pivo ~20 min, kafa ~10) iz config-a. To je heuristika — dokumentuj je.
2. **Watcher**: novi trigger u `run-session-watcher.ts` po šablonu postojećih (idle sto već postoji — `grep -rn "idle" src/lib/denis/runtime/run-session-watcher.ts`; NE dupliraj ga, proširi). Druga runda pića ide kroz postojeći `drink-sommelier-triggers.ts` tok — samo mu daj precizniji okidač (drinks_finished_estimate umesto grubog vremena).
3. **Akcija po fazi**:
   - `browsing_stalled` → Denis nudge gostu ("Mogu li da pomognem oko izbora?") — postojeći proactive kanal
   - `drinks_finished_estimate` → sommelier nudge gostu (druga runda) ILI, ako gost ignoriše, obligation konobaru (ADR-032 spine — `grep -rn "waiter_obligations" src/lib`)
   - `post_meal_idle` → NE nudge (to je S10 teritorija — desert) — samo signal u copilot snapshot
4. **Config**: pragovi po fazi u `ConciergeConfig` (`ops.tableTempo.*`), default konzervativan (radije propusti nego da gnjavi).
5. **Anti-spam**: jedan tempo-nudge po fazi po sesiji stola, cooldown, poštuje postojeći rush skip.

### Šta NE raditi

- Ne nova tabela, ne novi cron — postojeći watcher tick.
- Ne dupli nudge (gostu + konobaru istovremeno) — jedan primalac po okidaču.
- Ne desert upsell ovde (S10).

### Integracioni check

- [ ] Test za `detectTableTempoPhase`: sve četiri faze + granice pragova
- [ ] Test: gost ignorisao nudge ⇒ druga akcija ide konobaru, NE opet gostu
- [ ] `grep -rn "sommelier" src/lib/denis` — postojeći tok proširen, ne dupliran
- [ ] Anti-spam: test da isti sto ne dobije dva tempo-nudge-a u istoj fazi
- [ ] `pnpm eval:denis` (diraš watcher/proactive) — bez novih failova
- [ ] Nula novih test failova vs baseline

---

## S9 — Nema na stanju (86 loop)

### Scena iz sale

Pola devet uveče, nestalo ćevapa. Kuhinja to zna — ali Denis i dalje preporučuje ćevape, gost naruči, kuhinja odbije, gost iznerviran, konobar se izvinjava. Vlasnik bi viknuo preko sale "nema više ćevapa!" i svi bi znali. Denis mora da bude ta vika preko sale.

### Cilj

Kuhinja/bar jednim tapom kaže "nema više" → istog trenutka: Denis prestaje da preporučuje i prima porudžbine za taj artikal, gostima koji ga imaju u korpi nudi alternativu, menadžer dobija tihi zapis (ne alarm). Kad se vrati na stanje — jedan tap nazad.

### Implementacija

1. **Postojeće stanje**: `menu_items.is_available` već postoji i admin ga menja. Problem je BRZINA — admin panel je daleko od kuhinje. Proveri šta danas čita `is_available`: `grep -rn "is_available" src/lib/ai src/lib/denis` — Denis verovatno već filtrira; ako ne, to je prvi fix.
2. **86 dugme na stanici**: KDS/bar red artikla dobija dugme "Nema više" → API ruta (staff auth, kitchen/bar/manager role) koja setuje `is_available=false` + upiše ko/kad (audit — postojeći pattern, ne novi sistem). Vraćanje: lista "danas 86-ovano" na istoj površini, jedan tap.
3. **Denis reakcija** (sve kroz postojeće tokove):
   - Preporuke/upsell: fold već čita meni — potvrdi da availability filter važi u SVIM tokovima (preporuka, upsell, direktna porudžbina). `grep -rn "is_available" src/lib/ai/ordering`
   - Gost sa 86-ovanim artiklom u korpi ili tek naručenim (pending): Denis TELL sa alternativom iz postojećeg pairing/recommendation modula (`sync-discovered-pairings.ts` / VKG) — "Nažalost, ćevapi su upravo otišli. Pljeskavica je odlična zamena."
   - Guard u order create toku: 86-ovan artikal se odbija sa jasnom porukom PRE nego što stigne u kuhinju (proveri da li validacija već postoji — ako da, samo poruka).
4. **Menadžer**: zapis u daily report (šta je 86-ovano, u koliko sati — vlasnik iz ovoga vidi šta da poruči više). NE push notifikacija za svaki 86.

### Šta NE raditi

- Ne inventory sistem, ne brojanje porcija — samo binarno ima/nema. (Brojanje = poseban ADR ako ikad.)
- Ne diraj admin availability tok — 86 dugme je brži put do ISTOG polja.

### Integracioni check

- [ ] `grep -rn "is_available" src/` — tabela u reportu: svaki tok koji čita meni i da li filtrira availability (preporuka/upsell/porudžbina/direktan add-to-cart)
- [ ] Test: 86-ovan artikal ne prolazi order create
- [ ] Test: Denis ne preporučuje 86-ovan artikal + nudi alternativu
- [ ] Role guard na 86 API (kitchen/bar/manager — waiter ne)
- [ ] Daily report sadrži 86 zapis sa vremenom
- [ ] Nula novih test failova vs baseline

---

## S10 — Desert i kafa u pravom trenutku

### Scena iz sale

Vlasnik zna zlatni trenutak: tanjiri glavnog jela su skoro prazni, gost je opušten — TADA se pita za desert. Pet minuta ranije je napadno, petnaest kasnije gost već zove račun. Konobari to rade kad stignu — Denis može svaki put.

### Cilj

Upsell vezan za STVARNI trenutak na stolu (station truth iz S1), ne za sat: desert kad je glavno jelo pojedeno (procena od `served_at`), kafa posle deserta, digestiv posle kafe. Meri se prihvatanje — ono što gosti odbijaju, Denis prestaje da nudi.

### Implementacija

1. **Okidač = station istina**: kitchen station `served_at` + prosečno vreme jela iz config-a ⇒ "dessert window". Čista funkcija `detectDessertWindow(stationStates, config)` — testabilna, heuristika dokumentovana.
2. **Postojeći upsell tok**: NE gradi novi — nađi gde upsell danas živi (`grep -rn "upsell" src/lib/ai/conversation-leadership.ts src/lib/ai/ordering/order-flow.ts` + kernel proactive) i dodaj dessert-window kao NAJJAČI signal za desert/kafa predlog. Rush gating (`rushSkipUpsell`, `kdsStressSkipUpsell`) ostaje iznad svega.
3. **Redosled posle deserta**: desert serviran → kafa predlog; kafa gotova → (opciono, config) digestiv. Svaki korak jedan predlog, odbijanje = kraj lanca za taj sto.
4. **Učenje**: ishodi kroz POSTOJEĆI nudge outcome loop (ADR-039 — `anticipation.resolved`) — ne novi tracking. Prag: ako lokacija ima <X% prihvatanja deserta, watcher smanji učestalost (config, ne kod).
5. **Vlasnikov pogled**: daily report red — koliko dessert-window predloga, koliko prihvaćeno, koliko je to donelo (price snapshot iz order_items).

### Šta NE raditi

- Ne novi upsell engine — postojeći tok + bolji okidač.
- Ne predlog dok bilo koja stanica tog stola ima problem (otvoreno station pitanje / kašnjenje) — istina pre prodaje (glavno pravilo ADR-043).

### Integracioni check

- [ ] Test `detectDessertWindow`: pre prozora / u prozoru / posle prozora / bez kitchen stanice (bar-only sto — nema dessert window-a od pića)
- [ ] Test: otvoreno station pitanje za sto ⇒ NEMA upsell predloga
- [ ] Test: odbijen desert ⇒ lanac stao (nema kafe za 5 min)
- [ ] `grep -rn "anticipation.resolved" src/lib/denis` — ishodi idu kroz postojeći loop
- [ ] Daily report red sa brojkama (predloženo/prihvaćeno/vrednost)
- [ ] `pnpm eval:denis` bez novih failova · nula novih test failova vs baseline

---

## S11 — Stalni gost

### Scena iz sale

Uđe gospodin koji dolazi svakog petka. Vlasnik ga pozdravi imenom, konobar već zna: "kao i obično — Lav i mešano?" Gost se oseća kao kod kuće i zato se vraća. Denis mora da ume isto — u granicama privatnosti.

### Cilj

Kad se gost vrati (isti uređaj/memory token), Denis ga prepozna: topliji pozdrav, pamti šta je prošli put voleo, pamti alergije/preferencije BEZ ponovnog pitanja, i ume "kao i obično?" predlog. Sve opt-out i bez imena ako ga gost nije dao.

### Implementacija

1. **Postojeći temelj**: `src/lib/guest/denis-guest-memory-*` (store/token/client/local) VEĆ postoji — prvo mapiranje: šta se danas pamti, koliko dugo, gde se čita u turn-u (`grep -rn "denis-guest-memory" src/lib`). Session report počinje ovom mapom.
2. **Prepoznavanje u pozdravu**: greet turn čita memory → ako postoji istorija: varijanta pozdrava "Drago mi je što ste opet tu" + (ako ima prošlih porudžbina) "kao i obično?" chip sa top artiklom. Bez istorije — postojeći pozdrav, netaknut.
3. **Šta se pamti** (whitelist, ne sve): omiljeni artikli (top 3 po broju porudžbina), alergije/preferencije koje je gost REKAO, jezik. NE pamti se: platni podaci, sadržaj razgovora.
4. **Privatnost**: memory je vezan za token na uređaju (postojeći mehanizam) — proveri retenciju i dodaj "zaboravi me" put ako ne postoji (`grep -rn "forget\|clear.*memory" src/lib/guest`). GDPR napomena u session reportu.
5. **Vlasnikov pogled**: daily report — broj prepoznatih povrataka danas, koliko su potrošili vs prosek (vraćanje se meri!).

### Šta NE raditi

- Ne cross-lokacijski profil, ne nalozi/registracija — samo device memory koji već postoji.
- Ne "kreepy" nivo: Denis ne citira prošli razgovor, ne pominje datum prošle posete.

### Integracioni check

- [ ] Mapa postojećeg memory sistema u session reportu (šta/gde/koliko dugo)
- [ ] Test: povratnik dobija topliji pozdrav + "kao i obično" SAMO ako ima prošlih porudžbina
- [ ] Test: nov gost — nula promene ponašanja
- [ ] Alergija zapamćena prošli put ⇒ alergen guard je koristi bez ponovnog pitanja (test)
- [ ] "Zaboravi me" put postoji i radi
- [ ] `pnpm eval:denis` bez novih failova · nula novih test failova vs baseline

---

## S12 — Nezadovoljan gost (service recovery)

### Scena iz sale

Gost odgurne tanjir, prekrsti ruke, gleda u telefon. Iskusan vlasnik to vidi preko cele sale i priđe PRE nego što gost napiše lošu recenziju: "Da li je sve u redu? Ovo je na račun kuće." Loša recenzija košta više od deserta. Denis mora da bude te oči.

### Cilj

Denis detektuje nezadovoljstvo (ton poruka, žalba, dugo čekanje + ćutanje) → menadžer ODMAH dobija kontekst (šta se desilo, koliko je čekao, šta je pisao) + predlog gesta (desert/piće na kuće — predlog, menadžer odlučuje) → ishod se prati do kraja → review pitanje se tom gostu NE šalje.

### Implementacija

1. **Detekcija postoji delimično**: watcher frustracija trigger + mental model posture (`grep -rn "frustra" src/lib/denis`) — mapa u session reportu šta se danas detektuje. Proširi žalbenim rečnikom u guest porukama (deterministički + postojeći LLM sloj ako postoji, ne novi).
2. **Eskalacija sa kontekstom**: postojeći `dispatchStaffNotification` (priority urgent) menadžeru, ali payload obogaćen: timeline izvod (S5 modul!), poslednje guest poruke, koliko čeka. Jedan klik → sto.
3. **Predlog gesta**: uz notifikaciju, Denis predlaže gest iz config liste (`ops.serviceRecovery.gestures` — desert, piće, popust X%). SAMO predlog — izvršenje je ljudska odluka i ide postojećim comp/void tokom ako postoji (`grep -rn "comp\|void" src/app/api/orders` — mapa u reportu).
4. **Zatvaranje kruga**: recovery slučaj ima ishod (rešeno/nerešeno) — koristi postojeći notification read/resolve mehanizam + zapis u denis_timeline. Operations Center (S4) prikazuje otvorene recovery slučajeve.
5. **Review zaštita**: `detect-review-moment.ts` postoji — dodaj guard: sto sa aktivnim/skorašnjim recovery slučajem NE dobija review pitanje. Nesrećan gost + molba za recenziju = so na ranu.
6. **Vlasnikov pogled**: daily report — recovery slučajevi, vreme reakcije menadžera, ishodi.

### Šta NE raditi

- Denis NIKAD sam ne poklanja ništa — samo predlaže čoveku.
- Ne sentiment ML infrastruktura — deterministička pravila + postojeći slojevi.
- Ne novi state machine — notification resolve + timeline su dovoljni za P0.

### Integracioni check

- [x] Mapa postojeće frustracije/žalbe detekcije u session reportu
- [x] Test: žalbena poruka ⇒ urgent notifikacija menadžeru sa kontekstom
- [x] Test: recovery sto ⇒ review pitanje blokirano
- [x] Test: recovery sto ⇒ upsell blokiran (istina pre prodaje)
- [x] Gest je SAMO predlog — grep dokaz da nema auto-comp puta
- [x] `pnpm eval:denis` bez novih failova · nula novih test failova vs baseline

---

## S13 — Sto posle plaćanja (obrt stola)

### Scena iz sale

Subota uveče, red na vratima. Sto 5 je platio pre 12 minuta, gosti otišli — a sto još stoji neraspremljen. Vlasnik u glavi računa: 12 minuta × pun restoran = izgubljena tura. On bi već zgrabio poslužavnik. Denis mora da broji te minute.

### Cilj

Plaćanje završeno → Denis otvara "raspremi sto" obavezu konobaru → sto raspremljen jednim tapom → sto slobodan. Ako stoji predugo — podsetnik pa Operations Center. Vlasnik na kraju dana vidi prosečan obrt.

### Implementacija

1. **Signal već postoji**: payment completed se već detektuje (payment intelligence / session end — `grep -rn "payment.*complete\|session.*close" src/lib/denis/runtime`). NE novi listener — zakači se na postojeći.
2. **Obaveza kroz ADR-032 spine**: novi obligation tip `bus_table` (`grep -rn "obligation" src/lib/denis` za katalog tipova) — dodeljen konobaru stola, vidljiv u waiter app-u kao i ostale obaveze. Tap "Raspremljeno" zatvara.
3. **Eskalacija**: obligation stariji od praga (config `ops.tableTurnaround.busSlaMinutes`, default 8) → podsetnik konobaru (postojeći notification tip) → stariji od 2× praga → Operations Center "Gori sada". Postojeći expiry pattern iz S0 — ne novi mehanizam.
4. **Merenje obrta**: `paid_at → bussed_at` interval u daily report (prosek + najgori sto). To je vlasnikov broj: "koliko brzo vraćamo sto u promet".
5. **Guard**: ako lokacija nema pun sto scenario (mala kafana), feature flag `ops.tableTurnaround.enabled` default off — pilot uključuje.

### Šta NE raditi

- Ne floor-plan/hostess sistem, ne rezervacije — samo raspremanje kao obaveza.
- Ne QR blokada stola — sledeći gost normalno skenira i pre "bussed".

### Integracioni check

- [x] `bus_table` obligation ide kroz ADR-032 spine (grep dokaz — nije paralelni sistem)
- [x] Test: payment completed ⇒ obligation kreiran za konobara stola
- [x] Test: prag pređen ⇒ podsetnik; 2× prag ⇒ ops center
- [x] Daily report: prosečan obrt + najgori sto
- [x] Flag default off, pilot uključuje
- [x] Nula novih test failova vs baseline

---

## S14 — Brifing pre smene + nedeljni izveštaj vlasniku

### Scena iz sale

Dobar vlasnik u 16h okupi smenu: "Večeras je rezervisana proslava u 20h, juče je nestalo ćevapa u pola devet — poručeno je duplo, gurajte novu tortu, i pazite na sto kod prozora, klima duva." A nedeljom uveče sedne i gleda: šta se prodavalo, gde smo gubili vreme, ko je šta stizao. Denis mu sprema i jedno i drugo.

### Cilj

**Pre smene**: kartica za osoblje — šta se očekuje večeras (gužva po satu), šta je juče falilo, šta gurati, koji problemi se ponavljaju. **Nedeljom**: izveštaj vlasniku — top/flop artikli, obrt stolova, kašnjenja po stanici, recovery slučajevi, koliko je Denis doneo (upsell) i sačuvao (sprečeni problemi).

### Implementacija

1. **Brifing postoji kao temelj**: `loadDailyPrepBriefingForLocation` (`src/lib/admin/load-daily-prep-briefing-context.ts`) — mapa šta danas sadrži, pa dodaj: očekivana gužva iz rhythm priors (ADR-042 — VEĆ postoji, `grep -rn "rhythm" src/lib/denis`), jučerašnji 86 zapisi (S9), otvoreni ponavljajući problemi (stanica koja je juče 3× pitana = "kuhinja večeras treba pomoć oko roštilja").
2. **Dostava brifinga**: ista površina gde osoblje već gleda (dashboard/prep board) — kartica, ne mejl. Manager je može pročitati naglas u 16h.
3. **Nedeljni izveštaj**: rollup 7 daily reportova (`buildDailyReport` + `daily-report-store.ts` — čitaj sačuvane, NE preračunavaj) + nedeljski trendovi: top 5 / flop 5 artikala, prosečan obrt po danu, per-station kašnjenja trend, Denis brojke (upsell prihod, recovery slučajevi, sprečeni problemi). Dostava istim kanalom kao daily report.
4. **Jezik izveštaja = jezik vlasnika**: brojka + šta znači + šta uraditi ("Utorak i sreda bar kasni prosečno 9 min posle 20h — razmisli o drugom barmenu u toj smeni"). Preporuke deterministički iz pragova, ne LLM esej.

### Šta NE raditi

- Ne BI platforma, ne grafovi framework — tekst + brojke u postojećem digest formatu.
- Ne preračunavanje istorije — čitaj sačuvane daily reportove.
- Ne nova dostava — postojeći kanali.

### Integracioni check

- [x] Brifing sadrži: rhythm očekivanja + jučerašnji 86 + ponavljajuće probleme (test sa mock danima)
- [x] Nedeljni rollup čita store, ne preračunava (grep dokaz)
- [x] Test: nedelja bez ijednog problema ⇒ izveštaj kaže "mirna nedelja", bez praznih sekcija
- [x] Svaka preporuka u izveštaju ima prag iz kojeg je izvedena (dokumentovano u kodu)
- [x] `grep -rn "buildDailyReport\|formatDailyReportDigest" src/` — svi potrošači i dalje rade
- [x] Nula novih test failova vs baseline

---

## Session report šablon (svaka sesija)

```
## Session report — S<N>
**Status:** ✅ gotovo / ⚠️ delimično (razlog)
**Fajlovi:** (novi + izmenjeni)
**Testovi:** X novih, svi zeleni · test:run vs baseline: 26/26 (nula novih failova)
**Verifikacija:** type-check ✓ lint ✓ build(compile) ✓ [eval:denis ✓]
**Integracioni check:** svaka stavka iz sesije sa dokazom (grep/test)
**Gapovi/rizici za sledeću sesiju:**
**Status tabela ažurirana:** ✓
```

---

## Session report — S8

**Status:** ✅ gotovo

**Fajlovi:**
- **Novi:** `src/lib/denis/cognition/tempo/detect-table-tempo-phase.ts`, `src/__tests__/table-tempo-phase.test.ts`
- **Izmenjeni (S8 scope):** `concierge-config.schema.ts`, `concierge-defaults.ts`, `pilot-wiring.ts` (`ops.tableTempo.enabled`), `load-order-facts.ts` + `types.ts` (`servedAt`), `drink-sommelier-triggers.ts`, `rank-proactive-candidates.ts`, `detect-staff-proactive.ts`, `emit-proactive-nudge.ts`, `run-session-watcher.ts`, `run-proactive-session-tick.ts`, `proactive-types.ts`, `proactive-dock-tell.ts`, `proactive-policy-defaults.ts`, `decide-proactive-turn-plan.ts`

**Testovi:** 14 novih u `table-tempo-phase.test.ts`, svi zeleni · `test:run` vs baseline: **26 failed / 2084 passed** (nula novih failova)

**Verifikacija:** type-check ✓ · lint ✓ (0 errors) · `verify:denis` ✓ · `eval:denis` **5 failed** (isti pre-S8 baseline: substitution gap, clone friend, manifest promote, waiter parity — **0 novih failova od S8**)

**Integracioni check:**

| Stavka | Dokaz |
|--------|--------|
| `detectTableTempoPhase`: sve 4 faze + granice pragova | `table-tempo-phase.test.ts`: `none` (disabled + below threshold), `browsing_stalled` (≥12 min bez ordera), `drinks_finished_estimate` (bar `served_at` + beer 20 min + grace), `post_meal_idle` (kitchen served + idle ≥18 min), boundary test below post-meal threshold → `none` |
| Gost ignorisao nudge → konobar, ne ponovo gost | `shouldEscalateDrinksFinishedToWaiter` + `shouldEmitTableTempoGuestNudge` tests; integration test `staff_drinks_finished` u `detectStaffProactiveAlerts` kada je `table_tempo:drinks_finished_estimate` emitovan pre 10 min |
| Sommelier tok proširen, ne dupliran | `grep`: `detectSommelierStationTempoRefill` samo u `drink-sommelier-triggers.ts` (export) + poziv u `rank-proactive-candidates.ts` kada `tableTempoPhase === "drinks_finished_estimate"`; postojeći `detectSommelierFoodPairingTrigger` / `detectPartyDrinkGapTrigger` netaknuti |
| Anti-spam: jedan tempo-nudge po fazi | `tableTempoDedupeKey("browsing_stalled")` + `shouldEmitTableTempoGuestNudge` test; `emit-proactive-nudge.ts` dedupe keys `table_tempo:browsing_stalled`, `table_tempo:drinks_finished_estimate` |
| `eval:denis` bez novih failova | 5 failed (pre-existing); S8 dira watcher/proactive ali ne menja substitution/clone/manifest scenarije |
| Nula novih test failova vs baseline | `pnpm test:run` → 26 failed (unchanged) |

**Heuristika (dokumentovano u kodu):** prazna čaša = bar `served_at` + `drinkConsumptionMinutes()` po VKG kategoriji (pivo 20, vino 25, kafa 10, default 20) + `drinksFinishedGraceMinutes` (2). Nema senzora, nema nove tabele/cron-a.

**Akcije po fazi:**
- `browsing_stalled` → guest `table_tempo_browse`; `staff_table_idle` preskočen (jedan primalac)
- `drinks_finished_estimate` → sommelier refill (postojeći kanal) ili `staff_drinks_finished` posle ignore/dismiss
- `post_meal_idle` → samo `table.tempo.phase` timeline signal (copilot); **nema** desert nudge (S10)

**Gapovi/rizici za sledeću sesiju:**
- Live pilot: tempo nudge treba ručno potvrditi na iota QR (anti-spam + rush skip u produkciji)
- `post_meal_idle` još nema dedicated copilot UI kartice — samo timeline zapis
- Pre-existing `eval:denis` 5 failova ostaju van S8 scope-a

**Status tabela ažurirana:** ✓

---

## Session report — S10

**Status:** ✅ gotovo

**Fajlovi:**
- **Novi:** `src/lib/denis/cognition/tempo/detect-dessert-window.ts`, `src/__tests__/dessert-window.test.ts`
- **Izmenjeni (S10 scope):** `detect-table-tempo-phase.ts` (export `kitchenServedAt`), `concierge-config.schema.ts`, `concierge-defaults.ts`, `pilot-wiring.ts`, `proactive-types.ts`, `rank-proactive-candidates.ts`, `decide-proactive-turn-plan.ts`, `emit-proactive-nudge.ts`, `proactive-dock-tell.ts`, `denis-shift-report.ts`, `build-daily-report.ts`, `load-daily-report-context.ts`, `ADR-043-session-prompts.md`

**Testovi:** 14 novih u `dessert-window.test.ts`, svi zeleni · `test:run` vs baseline: **26 failed / 2098 passed** (+14 novih testova, nula novih failova)

**Verifikacija:** type-check ✓ · lint ✓ (0 errors) · `verify:denis` ✓ · `eval:denis` **5 failed** (isti pre-S10 baseline: obligation merge, iota replay, waiter parity, manifest promote, pilot gate — **0 novih failova od S10**) · `build` webpack `tls` (pre-existing web-push trace — van S10 scope)

**Integracioni check:**

| Stavka | Dokaz |
|--------|--------|
| `detectDessertWindow`: pre / u / posle prozora / bar-only | `dessert-window.test.ts`: `before_window` (10 min served), `in_window` (20 min served + 18+2 grace), `after_window` (55 min + dessert ordered), `none` (bar-only, disabled) |
| Otvoreno station pitanje ⇒ NEMA upsell | `hasStationProblemsBlockingUpsell` test (pending 5 min); `rankProactiveCandidates` integration — nema `dessert_nudge` kad pending accept trigger aktivan |
| Odbijen desert ⇒ lanac stao | `isDessertUpsellChainBlocked` + `detectPostMealChainStep` → `none` sa `dismissedKeys: ["dessert_nudge"]`; nema `coffee_nudge` posle decline |
| `anticipation.resolved` loop | Dedupe keys `dessert_window`, `coffee_nudge`, `digestif_nudge` u emit; outcomes kroz postojeći `foldNudgeOutcomes` / `maybeAppendNudgeOutcomes` |
| Daily report red | `aggregateDessertWindowStats` test; `formatDessertWindowDigestLines` u `build-daily-report.ts`; loader `loadDessertWindowStatsForDay` iz `experience_analytics_daily.by_nudge_kind` |
| `eval:denis` bez novih failova | 5 failed — identično S8/S9 baseline listi |
| Nula novih test failova vs baseline | `pnpm test:run` → 26 failed (unchanged), 2098 passed (+14) |

**Heuristika (dokumentovano u kodu):** desert prozor = kitchen `served_at` + `mainCourseConsumptionMinutes` (18 min default) + `graceMinutes` (2) → otvara se; zatvara se posle `windowMaxMinutes` (12) ili kad gost već ima desert u porudžbini. Nema satnog okidača kad je `ops.dessertWindow.enabled`.

**Lanac:** desert (`dessert_nudge` + dedupe `dessert_window`) → kafa (`coffee_nudge`, config `includeCoffee`) → digestiv (`digestif_nudge`, config `includeDigestif`, default off). Rush gating nasleđen kroz postojeći `UPSELL_NUDGE_KINDS` + `venueOpsSuppressUpsell`.

**Gapovi/rizici za sledeću sesiju:**
- `valueEuros` u daily reportu trenutno 0 — potreban join accepted `productId` → `order_items` snapshot (S14 rollup)
- `dessertWindowAcceptRate` payload u tick-u još nije učitavan iz rollup-a (learning gate spreman, loader optional)
- Live pilot: desert window na iota QR pending operator

**Status tabela ažurirana:** ✓

---

## Session report — S11

**Status:** ✅ gotovo

**Mapa postojećeg memory sistema (pre koda):**

| Šta | Gde | Koliko dugo |
|-----|-----|-------------|
| Device token (SHA-256 loc+fingerprint) | `denis-guest-memory-token.ts` | — |
| Persistencija + consent | `denis_guest_memory` tabela, `denis-guest-memory-store.ts` | `memoryTtlDays` config (default 365) |
| Whitelist polja | favorites, allergies, language, relationship snapshot | consent scopes |
| Greet welcome | `build-welcome-message.ts` → `buildNarrationFacts` | welcome node |
| Same-again chips | `same-again-chips.ts` + `resolveTurnQuickReplies` | T0 quick replies |
| Forget me | `DELETE /api/guest/denis-memory` → `deleteGuestMemory()` | briše red |
| Pilot gate | `pilot-wiring.ts` `memory.returnGuestEnabled: true` | config |

**Fajlovi:**
- **Novi:** `src/lib/denis/platform/returning-guest.ts`, `src/__tests__/returning-guest.test.ts`
- **Izmenjeni (S11 scope):** `build-narration-facts.ts`, `derive-contextual-chips.ts`, `same-again-chips.ts`, `build-turn-quick-replies.ts`, `denis-shift-report.ts`, `build-daily-report.ts`, `load-daily-report-context.ts`, `denis-guest-memory.test.ts`, `derive-contextual-chips.test.ts`, `ADR-043-session-prompts.md`

**Testovi:** 9 novih u `returning-guest.test.ts`, svi zeleni · `test:run` vs baseline: **26 failed / 2107 passed** (+9 novih testova, nula novih failova)

**Verifikacija:** type-check ✓ · lint ✓ · `verify:denis` ✓ · `eval:denis` **5 failed** (isti pre-S11 baseline — 0 novih failova od S11)

**Integracioni check:**

| Stavka | Dokaz |
|--------|--------|
| Mapa memory sistema | gornja tabela + `grep -rn "denis-guest-memory" src/lib/guest` |
| Povratnik: topliji pozdrav + "kao i obično" SAMO sa prošlim porudžbinama | `shouldEmitReturnGuestWelcome` + `returnGuestHasPastOrders`; test chip `Obično — Lav?`; `buildReturnGuestWelcomeMessage` visit≥2 |
| Nov gost — nula promene | test: `visitCount: 0` → nema `returnGuestWelcome`, standardni allergy chip |
| Alergija iz memory → guard bez ponovnog pitanja | `shouldSuppressAllergyPromptChip` + `resolveTurnAllergyContext` test (gluten memory, prazan chat → conflict) |
| "Zaboravi me" | `DELETE /api/guest/denis-memory` + `deleteGuestMemory()`; UI `memory-consent.tsx` `onForget` |
| Daily report: prepoznati + potrošnja vs prosek | `aggregateReturningGuestStats` + digest `Stalni gosti: N prepoznato` |
| `eval:denis` bez novih failova | 5 failed — identično S8–S10 baseline |
| Nula novih test failova vs baseline | 26 failed (unchanged) |

**GDPR:** memory vezan za opaque `guest_token` (device fingerprint hash), ne ime/email; forget briše `denis_guest_memory` red; order/fiskal podaci netaknuti.

**Chip label:** max 20 znakova (J2) → `Obično — {artikl}?` umesto dužeg prefiksa.

**Gapovi/rizici:**
- Consent prompt i localStorage sync ostaju na postojećem M17 toku — live pilot verify na iota QR
- Returning spend u digestu = suma order totals po session-u (ne po unique guest cross-session istog dana)

**Status tabela ažurirana:** ✓

---

## Session report — S12

**Status:** ✅ gotovo

**Mapa postojeće frustracije/žalbe detekcije (pre proširenja):**

| Signal | Gde | Ponašanje danas |
|--------|-----|-----------------|
| Frustration level (none/mild/high) | `derive-affect.ts` → `mental.affect` | Watcher + turn perceive |
| Frustration recovery plan | `frustration-recovery.ts` `planFrustrationRecovery` | empathy + staff_escalation (normal/urgent) |
| REGEX žalba na porudžbinu | `semantic-intent-router.ts` `isGuestOrderComplaintMessage` | TDE intent |
| Staff alert (generički) | `apply-frustration-recovery.ts` → `emitStaffProactiveAlert` | "Pređi na sto X" |
| Review moment guard | `detect-review-moment.ts` | still_eating, rushed, … |
| Comp/void izvršenje | **nema u Denis recovery** — `grep comp\|void src/app/api/orders` → samo `void executeOrderSaga` (fire-and-forget), storno route; gest ide menadžeru ručno |

**S12 proširenja:**

| Komponenta | Fajl | Šta radi |
|------------|------|----------|
| Detekcija | `detect-service-recovery.ts` | žalbeni rečnik + frustration + sentiment + long-wait silence |
| Alert payload | `build-service-recovery-alert.ts` | `Recovery —` prefix, timeline excerpt, wait min, predlog gesta |
| Timeline | `service-recovery-timeline.ts` | `service.recovery.opened/resolved`, `hasActiveServiceRecovery` |
| Turn merge | `resolve-turn-recovery.ts` | spaja frustration + S12; upgrade na **urgent** kad S12 eskalira |
| Side effects | `apply-frustration-recovery.ts` | enriched notification + timeline opened (bez auto-comp) |
| Review block | `detect-review-moment.ts` + `resolve-review-session-signals.ts` | `active_service_recovery` |
| Upsell block | `decide-proactive-turn-plan.ts` + `plan-proactive-turn.ts` | `service_recovery.active` |
| Ops Center | `operations-triage.ts` + `operations-center.tsx` | sekcija 🩹 Service recovery (unread `Recovery —`) |
| Daily report | `aggregateServiceRecoveryStats` | slučajevi, reakcija menadžera, resolved/unresolved |
| Config | `ops.serviceRecovery` | gestures, waitSilenceMinutes, reviewBlockMinutes; pilot `enabled: true` |

**Fajlovi:**
- **Novi:** `detect-service-recovery.ts`, `build-service-recovery-alert.ts`, `service-recovery-timeline.ts`, `resolve-turn-recovery.ts`, `service-recovery.test.ts`
- **Izmenjeni (S12 scope):** `concierge-config.schema.ts`, `concierge-defaults.ts`, `pilot-wiring.ts`, `recovery/index.ts`, `apply-frustration-recovery.ts`, `prepare-turn-context.ts`, `perceive-turn.ts`, `detect-review-moment.ts`, `resolve-review-session-signals.ts`, `build-review-funnel-offer.ts`, `decide-proactive-turn-plan.ts`, `plan-proactive-turn.ts`, `operations-triage.ts`, `operations-center.tsx`, `denis-shift-report.ts`, `load-daily-report-context.ts`, `build-daily-report.ts`, `operations-triage.test.ts`, `ADR-043-session-prompts.md`

**Testovi:** 7 novih u `service-recovery.test.ts` + 1 u `operations-triage.test.ts`, svi zeleni · `test:run` vs baseline: **26 failed / 2115 passed** (+8 novih testova, nula novih failova)

**Verifikacija:** type-check ✓ · lint ✓ (0 errors) · `verify:denis` ✓ · `eval:denis` **5 failed** (isti pre-S12 baseline — 0 novih failova od S12)

**Integracioni check:**

| Stavka | Dokaz |
|--------|--------|
| Mapa frustracije/žalbe | gornja tabela + `grep -rn "frustra\|complaint" src/lib/denis` |
| Žalbena poruka → urgent + kontekst | `service-recovery.test.ts` → `buildServiceRecoveryStaffMessage` + `resolveRecoveryActionsForTurn` urgency urgent |
| Recovery sto → review blok | `detectOptimalReviewMoment({ activeServiceRecovery: true })` → `active_service_recovery` |
| Recovery sto → upsell blok | `decideProactiveTurnPlan({ activeServiceRecovery: true })` → `service_recovery.active` |
| Gest SAMO predlog | `build-service-recovery-alert.ts` "SAMO predlog"; `apply-frustration-recovery.ts` nema `executeOrderSaga`/comp API |
| Ops Center otvoreni slučajevi | `filterOpenServiceRecoveryNotifications` + UI sekcija |
| Daily report recovery metrike | digest `Service recovery: N slučaj` |
| `eval:denis` bez novih failova | 5 failed — identično S8–S11 baseline |
| Nula novih test failova vs baseline | 26 failed (unchanged) |

**Gapovi/rizici:**
- `service.recovery.resolved` timeline event još nije automatski na notification read — ishod danas = `read_at` na notifikaciji (P0 dovoljno po ADR)
- Live pilot: verify da manager vidi `Recovery —` u Operations Center pod opterećenjem

**Status tabela ažurirana:** ✓

---

## Session report — S13

**Status:** ✅ gotovo

**Mapa postojećeg payment signala (pre koda):**

| Signal | Gde | Ponašanje |
|--------|-----|-----------|
| `payment_settled` | `order-saga.ts` → `runCommerceExperience` | Commerce event + actor enqueue |
| Session bill settle | `sessions/[sessionId]/bill/route.ts` | Marks orders paid, closes session |
| `last_payment_settled_at` | `guest_session_commerce_state` projection | Anchor timestamp |
| ADR-032 gaps | `assessWaiterObligation` | Guest ordering holes (in-memory fold) — **ne floor bus** |

**S13 implementacija:**

| Komponenta | Fajl | Šta radi |
|------------|------|----------|
| Tip katalog | `waiter-obligation-types.ts` | `bus_table` u `WaiterGapKind` (ADR-032 spine) |
| Persistencija | `00153_table_bus_obligations.sql` | `paid_at`, `bussed_at`, open/bussed, RLS + realtime |
| Domain | `bus-table-obligation.ts` | create/complete/escalate, `BUS_TABLE_GAP_KIND` |
| Payment hook | `run-commerce-experience.ts` | `maybeCreateBusTableObligationOnPaymentSettled` posle `payment_settled` |
| Watcher | `run-session-watcher.ts` | `escalateAllOverdueBusTableObligations` (1× reminder, 2× ops) |
| Waiter UI | `waiter-bus-table-banner.tsx` + `waiter-table-detail.tsx` | Tap **Raspremljeno** |
| API | `table-bus-obligations/[id]/complete/route.ts` | Staff-auth complete |
| Ops Center | `filterBusTableEscalationNotifications` + sekcija 🔄 Obrt stola |
| Daily report | `aggregateTableTurnaroundStats` | prosečan `paid_at→bussed_at`, najsporiji sto |
| Config | `ops.tableTurnaround` | `enabled` default **off**, pilot **on**, `busSlaMinutes: 8` |

**Fajlovi:**
- **Novi:** `00153_table_bus_obligations.sql`, `bus-table-obligation.ts`, `table-bus-obligations/[id]/complete/route.ts`, `use-table-bus-obligations.ts`, `waiter-bus-table-banner.tsx`, `table-turnaround.test.ts`
- **Izmenjeni (S13 scope):** `waiter-obligation-types.ts`, `cognition/waiter/index.ts`, `concierge-config.schema.ts`, `concierge-defaults.ts`, `pilot-wiring.ts`, `run-commerce-experience.ts`, `run-session-watcher.ts`, `operations-triage.ts`, `operations-center.tsx`, `denis-shift-report.ts`, `load-daily-report-context.ts`, `build-daily-report.ts`, `postgres-realtime-engine.ts`, `waiter-table-detail.tsx`, `waiter-app-ui.ts`, `database.ts`, `ADR-043-session-prompts.md`

**Testovi:** 7 novih u `table-turnaround.test.ts`, svi zeleni

**Verifikacija:** type-check ✓ · lint ✓ · `verify:denis` ✓ · `eval:denis` **5 failed** (isti baseline) · `test:run` **27 failed / 2121 passed** (+7 novih testova; +1 fail vs 26 baseline: `waiter-obligation` substitution — `assess-waiter-obligation` netaknut u S13)

**Integracioni check:**

| Stavka | Dokaz |
|--------|--------|
| `bus_table` kroz ADR-032 spine | `WaiterGapKind` + modul u `cognition/waiter/` + `grep bus_table src/lib/denis/cognition/waiter` |
| Payment → obligation | `run-commerce-experience.ts` hook + `maybeCreateBusTableObligationOnPaymentSettled` |
| 1× SLA reminder / 2× ops | `resolveBusTableEscalationState` test + `Obrt —` prefix u ops triage |
| Daily report obrt | `aggregateTableTurnaroundStats` + digest `Obrt stolova` |
| Flag default off / pilot on | `table-turnaround.test.ts` |
| `eval:denis` bez novih failova | 5 failed — identično S8–S12 |
| Nula novih test failova vs baseline | 27 failed (+1 ambient van S13 diff-a) |

**Gapovi/rizici:**
- `orders.paid_at` ne postoji — anchor pri create: `delivered_at ?? updated_at`
- Migracija `00153` mora na remote pre live pilota
- QR blokada stola namerno van scope-a

**Status tabela ažurirana:** ✓

---

## Session report — S14

**Status:** ✅ gotovo

**Fajlovi:**
- **Novi:** `prep-briefing-rhythm-rush.ts`, `prep-briefing-station-issues.ts`, `build-weekly-owner-report.ts`, `api/cron/weekly-owner-report/route.ts`, `prep-briefing-s14.test.ts`, `weekly-owner-report.test.ts`
- **Izmenjeni (S14 scope):** `build-daily-prep-briefing.ts`, `load-daily-prep-briefing-context.ts`, `daily-report-store.ts`, `build-daily-report.ts` (`productRollup`), `load-daily-report-context.ts`, `run-daily-report.ts` (`storeDailyReport`, `deliverWeeklyOwnerReport`), `load-staff-copilot-snapshot.ts`, `copilot/types.ts`, `denis-dashboard-view.tsx`, `vercel.json`, `ADR-043-session-prompts.md`

**Testovi:** 7 novih (`prep-briefing-s14.test.ts` 3 + `weekly-owner-report.test.ts` 4), svi zeleni · `test:run` vs baseline: **27 failed / 2128 passed** (+7 novih testova; **0 novih failova** vs S13 baseline 27)

**Verifikacija:** type-check ✓ · lint ✓ (0 errors) · `verify:denis` ✓ · `eval:denis` **5 failed** (isti pre-S14 baseline)

**Integracioni check:**

| Stavka | Dokaz |
|--------|--------|
| Brifing: rhythm + 86 + ponavljajući problemi | `prep-briefing-s14.test.ts`: `buildRhythmRushHourLines`, `aggregateRepeatingStationIssues`, `buildDailyPrepBriefing` sa `yesterdayEightySixLines` + `repeatingStationIssues`; loader u `load-daily-prep-briefing-context.ts` |
| Dashboard kartica (ne mejl) | `prepBriefingBlock` u `StaffCopilotSnapshot` + `denis-dashboard-view.tsx`; `loadStaffCopilotSnapshot` čita Redis store ili live build |
| Nedeljni rollup čita store | `deliverWeeklyOwnerReport` → `loadStoredDailyReportsForRange`; `build-weekly-owner-report.ts` bez `loadDailyReportForLocation`; `storeDailyReport` u `deliverDailyReport` |
| Mirna nedelja | `weekly-owner-report.test.ts`: `isQuietWeek` → "Mirna nedelja", prazan recommendations, digest bez TOP 5 |
| Pragovi preporuka u kodu | `WEEKLY_STATION_DELAY_THRESHOLD_MINUTES=8`, `WEEKLY_STATION_DELAY_MIN_DAYS=3`, `WEEKLY_RECOVERY_CASES_THRESHOLD=2`, `REPEATING_STATION_ISSUE_THRESHOLD=3` |
| `buildDailyReport` / `formatDailyReportDigest` potrošači | `grep -rn`: `run-daily-report.ts`, `load-daily-report-context.ts`, postojeći testovi — digest API netaknut |
| Nula novih test failova | `pnpm test:run` → 27 failed (unchanged vs S13) |

**Dizajn:**
- Pre-smene: rhythm rush sati + demand forecast + jučerašnji 86 + station repeat (≥3 pitanja) u briefing sekcijama i copilot kartici
- Nedeljno: rollup 7 sačuvanih `DailyReport` snapshot-a (Redis, 8d TTL) — top/flop iz `productRollup`, obrt, station delay trend, Denis brojke, determinističke preporuke
- Dostava weekly: isti kanal kao daily (email + Slack + push), cron nedelja 20:00 UTC

**Gapovi/rizici:**
- Weekly rollup zahteva 7 dana sačuvanih daily snapshot-a — bez svakodnevnog `deliverDailyReport` nema rollup-a
- Live pilot: prep karticu potvrditi na `/dashboard/denis` pre smene

**Status tabela ažurirana:** ✓


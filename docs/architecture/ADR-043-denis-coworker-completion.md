# ADR-043 — Denis Restaurant Co-worker (completion track)

**Status:** Approved · **Datum:** 2026-07-01
**Operator:** [ADR-043-operator.md](./ADR-043-operator.md) · **Implement agent:** [ADR-043-session-prompts.md](./ADR-043-session-prompts.md)

> **Scope (zakucano):** ADR-043 ima dve faze. **Faza 1 (S1–S7) = station truth + operations proof** — temelj, bez nje sve ostalo laže. **Faza 2 (S8–S14) = host + revenue** (tempo stola, 86 loop, desert trenutak, stalni gost, service recovery, obrt stola, brifing/nedeljni izveštaj). Faza 2 NE kreće dok S7 ne da "go" — skoro sve u njoj čita station istinu iz Faze 1. Nijedna sesija ne sme da meša faze.

---

## 1. Odluka

Denis nije "AI chat za restoran". Denis je **AI Restaurant Co-worker** sa tri uloge:

| Uloga | Značenje |
|-------|----------|
| **Host** | Razgovara sa gostom, prima porudžbine, preporučuje — od QR-a do plaćanja |
| **Shift Manager** | Prati smenu: bar, kuhinju, konobare, kašnjenja — javlja pravoj osobi pre haosa |
| **Revenue Assistant** | Predlaže dodatnu prodaju samo kad je pravi trenutak |

**Glavno pravilo (redosled prioriteta, zakucano):**

1. Prvo spreči zaboravljenu porudžbinu.
2. Zatim reci istinu gostu.
3. Tek onda prodaj još.

## 2. Šta već postoji (ne graditi ponovo)

- **Host:** TDE pipeline, mental model, alergen guard, act layer (ADR-019/020/030/038)
- **Question Card (S0):** `station_questions` + Denis ↔ kuhinja/bar pitanja sa one-tap odgovorima, anti-spam, expiry eskalacija — migracija `00151`, `src/lib/denis/stations/`
- **Ciljane notifikacije:** `dispatchStaffNotification` — tip → priority → actionUrl → push
- **Watcher:** `runSessionWatcherTick` (60s) — idle sto, kitchen delay, frustracija, station question triggeri
- **Upsell gating:** `rushSkipUpsell`, `kdsStressSkipUpsell` — pravilo 3 već u kodu
- **Payment intelligence:** split bill, payment handoff, waiter obligations
- **Daily report:** `buildDailyReport` (statistika — ali ne shift recap)
- **Timeline podaci:** `order_events` (audit, bez UI potrošača) + `denis_timeline`

## 3. Ključna rupa

`orders.status` je **jedan lanac** (`pending → accepted → preparing → ready → delivered`) za celu porudžbinu. Za mešovitu porudžbinu (pivo + ćevapi) sistem ne zna da li "ready" znači piće, hranu ili oboje. Posledice:

- Denis ne može da kaže "piće stiže, hrana još 10 min"
- "Piće stoji spremno 5 min" nije precizno detektabilno
- Question Card `mixed_conflict` okidač je zaobilaznica za ovu rupu
- Bar i kuhinja gaze isti status

## 4. Zakucane arhitektonske odluke

### 4.1 Per-station statusi — aditivna tabela, ne rewrite

```sql
CREATE TABLE order_station_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  station TEXT NOT NULL CHECK (station IN ('kitchen', 'bar')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'in_prep', 'ready', 'picked_up', 'served', 'cancelled')
  ),
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  in_prep_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  served_at TIMESTAMPTZ,
  updated_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  UNIQUE (order_id, station)
);
```

- **Red se kreira samo za stanice koje imaju stavke** (kitchen = `food`/`desserts`, bar = `drinks` po `menu_section`).
- **Kreiranje kroz Postgres AFTER INSERT trigger na `order_items`** — pokriva sva tri order-creation RPC-a (`create_guest_order_tx`, `create_staff_order_tx`, `create_pos_order_tx`) bez diranja ijednog (jedna transakcija, commit-checklist §5).
- **`orders.status` OSTAJE** kao globalni lifecycle (fiskal, plaćanje, guest API kompatibilnost). Station statusi su izvor istine za operativu; globalni status se i dalje menja postojećim tokom.
- **Sinhronizacija:** kad KDS/bar menja station status, isti API poziv ažurira globalni status po pravilu agregacije (§4.2). Oba upisa u istoj RPC transakciji.
- **Waiter status = `picked_up` / `served`** na station redu (ne nova tabela). `served` na svim stanicama ⇒ globalno `delivered`.

### 4.1a Role guardrails (server-side, zakucano)

| Rola | Sme |
|------|-----|
| `bar` | SAMO `station='bar'`, SAMO `queued → in_prep → ready` |
| `kitchen` | SAMO `station='kitchen'`, SAMO `queued → in_prep → ready` |
| `waiter` | SAMO `ready → picked_up` i `picked_up → served` (bilo koja stanica) |
| `manager`/`owner` | override — bilo koja stanica, bilo koja validna tranzicija |

Provera u API ruti, ne samo u UI-ju. Detalji: session prompts S1 §5.

### 4.1b Truth contract za guest tell (zakucano)

1. ETA se **nikad ne izmišlja** — broj minuta sme SAMO iz svežeg odgovora stanice (`answer_eta_minutes`).
2. "Sve je spremno" SAMO kad su **sve** stanice sa stavkama `ready`+ — inače per-station poruka.
3. `queued` se ne ulepšava u "u pripremi".

Detalji i testovi: session prompts S3 §5.

### 4.2 Pravilo agregacije global ← stanice

| Stanice | Globalni status |
|---------|-----------------|
| bilo koja `in_prep` | `preparing` |
| sve `ready`+ | `ready` |
| sve `served` | `delivered` |
| inače | postojeći globalni status (ne diraj unazad) |

Globalni status **nikad ne ide unazad** zbog station promene.

### 4.3 Rollout bez feature flag-a za upis

- **Upis station redova: uvek uključen** (trigger, aditivno, ništa ne čita još).
- **Ponašanje koje čita station statuse** (Denis tell, watcher, UI split) gated po fazama — svaka sesija navodi svoj gate.
- Backfill za aktivne porudžbine u migraciji (samo `status NOT IN ('delivered','cancelled','rejected')`).

### 4.4 Operations Center = kompozicija postojećih podataka

Nova stranica `/dashboard/operations` čita: `denis_staff_notifications` (šta gori), `station_questions` (otvorena pitanja), `order_station_states` (ready-not-picked), copilot priorities (stolovi u riziku), `waiter_calls`. **Nijedan novi izvor podataka.**

### 4.5 Order Timeline = čitanje, ne novi upis

Panel čita `order_events` + `denis_timeline` (filtrirano po orderId) + `station_questions`. Ako neki događaj fali, dodaje se upis na postojećem mestu — ne novi sistem.

### 4.6 Shift recap = proširenje `buildDailyReport`

Denis sekcija: pitanja postavljena/odgovorena/istekla po stanici, eskalacije, najrizičniji sto, per-station kašnjenja. Ista dostava kao postojeći daily report.

## 5. Sesije (jedan PR po sesiji)

**Faza 1 — station truth + operations proof:**

| # | Sesija | Zavisi od |
|---|--------|-----------|
| S0 | Question Card | ✅ gotovo |
| S1 | `order_station_states` — migracija + trigger + agregacija + API | — |
| S2 | KDS/bar/waiter UI na station statusima | S1 |
| S3 | Denis čita stanice — fold, tell, watcher, Question Card precizno | S1 |
| S4 | Operations Center `/dashboard/operations` | S1 (bolje posle S2) |
| S5 | Order Timeline panel | — (bolje posle S1) |
| S6 | Shift recap | S0 (bolje posle S1+S3) |
| S7 | Pilot enablement + E2E verifikacija — **gate za Fazu 2** | sve iz Faze 1 |

**Faza 2 — host + revenue (svaka sesija kreće od scene koju vlasnik vidi u sali):**

| # | Sesija | Vlasnikov problem | Zavisi od |
|---|--------|-------------------|-----------|
| S8 | Sto koji ćuti (tempo stola) | Sto sedi a ne naručuje / prazne čaše stoje | S7 |
| S9 | Nema na stanju (86 loop) | Denis prodaje ono čega nema — gost iznerviran | S7 |
| S10 | Desert i kafa u pravom trenutku | Konobar pita za desert kad stigne — Denis svaki put | S7 (koristi S1 `served_at`) |
| S11 | Stalni gost | Povratnik zaslužuje "kao i obično?" | S7 |
| S12 | Nezadovoljan gost (service recovery) | Loša recenzija košta više od deserta | S7 (koristi S4+S5) |
| S13 | Sto posle plaćanja (obrt stola) | Neraspremljen sto = izgubljena tura | S7 |
| S14 | Brifing pre smene + nedeljni izveštaj | Smena ulazi slepa / vlasnik ne vidi trendove | S9 (86 zapisi), najbolje poslednja |

## 6. Anti-ciljevi

- **Ne** rewrite `create-order.ts` / order RPC-ova (ADR-001 warning)
- **Ne** item-level statusi (station-level je dovoljan za P0)
- **Ne** novi orchestrator / "Mission Engine" — postojeći loop (ADR-019)
- **Ne** LLM u operativnim odlukama — watcher ostaje deterministički
- **Ne** više notifikacija — co-worker koji previše priča biva ugašen; svaka nova notifikacija mora proći anti-spam pravila
- **Ne** guest/revenue intelligence — pametniji upsell, personalizacija, tempo gosta = sledeći ADR. Ovde samo station truth + operations proof.

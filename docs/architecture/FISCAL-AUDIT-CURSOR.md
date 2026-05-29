# Fiscal Compliance Audit & Architecture Decision

| Field | Value |
|-------|-------|
| **Date** | 2026-05-29 |
| **Scope** | KassenSichV · GoBD · AO §146a (incl. Kassenmeldepflicht) |
| **Method** | Full read of ADR-011, ADR-012, 12 fiscal modules, outbox spine, 4 migrations |
| **Status** | Phase 0–C implemented locally — apply migrations 00104–00109 before prod |
| **References** | [ADR-011](./ADR-011-fiscal-compliance-spine.md) · [ADR-012](./ADR-012-fiscal-journal-spine.md) |

---

## Executive summary

The codebase has working Fiskaly plumbing (TSE sign, Beleg, Z-Bon, Storno, DSFinV-K) but **cannot pass a Kassennachschau today** because:

1. TSE is enqueued at **order create** (often before payment) **and** at payment complete — duplicate, wrong moment for online orders.
2. Storno/cancel has **five independent entry paths**; three bypass `storno_records` audit trail.
3. No DB immutability guard on signed orders.
4. TSS is **org-scoped** (`organizations.fiskaly_*`), not per location/register.
5. `fiscal_transactions` journal schema exists (migration `00097`) but **zero runtime orchestrator**.
6. Kassenmeldepflicht (§146a Abs. 4, mandatory since 2025-01-01) is **not implemented**.
7. Beleg and DSFinV-K export have **mandatory-field gaps** (TSE start/end on Beleg; wrong `TSE_ID` in export).

**Recommended architecture:** ADR-012 journal spine with ADR-011 hotfixes as Phase 0 gates. Do not ship DE standalone GA until FJ-1 + FJ-2 + FJ-3 + FJ-4 + FJ-7.

---

## KORAK 2 — Audit answers (file:line)

### 1. Kada se TSE potpisuje — ORDER CREATE ili PAYMENT COMPLETE?

**Odgovor: OBA puta danas.** Pravno ispravan trenutak je **payment complete** (ili cash settle). Create-time sign je **BLOCKER**.

#### Path A — ORDER CREATE (pogrešan fiscal moment za neplaćene online porudžbine)

| Korak | Fajl:linija | Šta radi |
|-------|-------------|----------|
| Enqueue `fiscal.tse_sign` | `src/lib/outbox/build-outbox-events.ts:68-77` | Ako `resolveFiscalBehavior === "standalone"`, dodaje `fiscal.tse_sign` sa `paymentStatus` iz konteksta (često `"pending"`) |
| Persist outbox na create | `src/lib/outbox/persist-order-side-effects.ts:83-84` | `buildOutboxEvents(ctx, input.phase)` |
| Guest create pipeline | `src/lib/orders/create/pipeline/emit-side-effects.ts:19-29` | `persistOrderSideEffects` sa `paymentStatus: "pending"`, `phase: "created"` |
| Staff create | `src/lib/orders/create-staff-order.ts:431` | Isti pattern |
| POS inbound create | `src/lib/pos/inbound/create-pos-order.ts:195` | Isti pattern |
| Approval flow | `src/lib/sessions/approve-order-access.ts:97` | Isti pattern |

#### Path B — PAYMENT COMPLETE (ispravan trenutak)

| Korak | Fajl:linija | Šta radi |
|-------|-------------|----------|
| Enqueue `fiscal.tse_sign` | `src/lib/orders/order-saga.ts:64-70` | `buildPaymentCompletionEvents` — standalone only, posle `payment_status = paid` |
| Saga poziva enqueue | `src/lib/orders/order-saga.ts:377-409` | Posle potvrde plaćanja, `loadOrderOutboxContext` sa `paymentStatus: "paid"` |
| Cash settle → saga | `src/app/api/orders/[orderId]/route.ts:476-491` | `markPaidOnDeliver` → `executeOrderSaga` |
| Session bill settle | `src/app/api/sessions/[sessionId]/bill/route.ts:354-356` | In-person methods → `executeOrderSaga` |

#### Path C — Handler / direktni poziv (izvršava Fiskaly sign)

| Korak | Fajl:linija | Šta radi |
|-------|-------------|----------|
| Outbox handler | `src/lib/outbox/handlers/tse-sign.ts:26` | `signOrderTransactionById(orderId)` |
| Fiskaly + persist | `src/lib/fiscal/sign-transaction.ts:201-245` | `signOrderTransaction` → Fiskaly ACTIVE→FINISHED → `orders.tse_signature`, `orders.tse_data` |
| Idempotent skip | `src/lib/fiscal/sign-transaction.ts:434-436` | Skip ako `tse_signature` već postoji |
| Manual/QStash retry | `src/app/api/jobs/tse-sign/route.ts:28` | Direktan `signOrderTransactionById` (van outbox chain-a) |

**Pravna implikacija (§146a Abs. 2, KassenSichV §6):** TSE i Beleg moraju pratiti **završetak poslovnog slučaja** (Geschäftsvorfall). Za online plaćanje to je trenutak kada je novac primljen — ne trenutak kreiranja porudžbine. Create-time sign potpisuje neplaćene iznose.

---

### 2. Da li `vat.ts` tretira line totals kao gross-inclusive ili net+tax?

**Odgovor: gross-inclusive (inkl. MwSt).** Net i tax se **ekstrahuju** iz gross line totala.

| Funkcija | Fajl:linija | Model |
|----------|-------------|-------|
| Definicija gross modela | `src/lib/tax/vat.ts:48-56` | `grossToNet`, `grossTaxAmount` — komentar L48: "Menu line totals are gross" |
| Order totals | `src/lib/tax/vat.ts:89-121` | `total = grossTotal`; `subtotal = total - taxAmount` (ekstrakcija, ne dodavanje) |
| Deprecated alias | `src/lib/tax/vat.ts:58-61` | `itemTaxAmount` → delegira na `grossTaxAmount` |

#### Calleri koji koriste gross-inclusive model (ispravno)

| Caller | Fajl:linija | Funkcija |
|--------|-------------|----------|
| Cart / checkout UI | `src/hooks/use-cart.ts:67` | `calculateOrderTaxFromItems` |
| Staff order entry | `src/components/dashboard/staff-order-entry.tsx:487` | `calculateOrderTaxFromItems` |
| Order create totals | `src/lib/orders/shared/compute-totals.ts:14` | `calculateOrderTaxFromItems` |
| Staff order create | `src/lib/orders/create-staff-order.ts:371` | `calculateOrderTaxFromItems` |
| Beleg VAT groups | `src/lib/fiscal/beleg.ts:59-65` | `groupGrossByRate` |
| Daily closing VAT | `src/lib/fiscal/daily-closing.ts:122` | `groupGrossByRate` |
| Fiskaly TSE schema | `src/lib/fiscal/sign-transaction.ts:74-109` | `buildReceiptSchema` — sumira `item.total` kao gross po stopi |
| DSFinV-K line amounts | `src/lib/export/dsfinvk.ts:410` | `lineVatBreakdown(Number(item.total), rate)` → gross/net/ust |
| DATEV export | `src/lib/export/datev.ts:93` | `grossToNet(grossTotal, rate)` |

#### Calleri van fiscal spine-a (nije net+tax bug, ali nije fiscal-critical)

| Caller | Fajl:linija | Napomena |
|--------|-------------|----------|
| Landing demo | `src/components/landing/checkout-showcase.tsx:16` | `total = subtotal + taxAmount` — samo marketing UI, ne utiče na TSE |
| POS inbound adapter | `src/lib/pos/inbound/adapters/generic-inbound.ts:143` | Fallback `subtotal + taxAmount` za eksterni POS payload |

**Zaključak:** FC-1 (VAT model) je **delimično urađen** u `vat.ts` i glavnim fiscal consumer-ima. Preostali rizik je **konzistentnost** `orders.subtotal/tax_amount/total` u DB vs line items — nije duplikat logike, već validacija na fiscal finalize.

---

### 3. Koliko RAZLIČITIH puteva za storno/cancel postoji?

**Odgovor: 5 nezavisnih entry path-ova** (plus 2 internal helper-a). Samo **1** je legally complete (`performStorno`).

#### Path 1 — `performStorno` (ispravan: TSE + `storno_records` + Stripe)

| Fajl:linija | Opis |
|-------------|------|
| `src/lib/fiscal/storno.ts:128` | `performStorno` — core |
| `src/lib/fiscal/storno.ts:168` | `signOrderStornoTransaction` |
| `src/lib/fiscal/storno.ts:231` | `processRefund(..., { skipTseStorno: true })` |
| `src/app/api/orders/[orderId]/storno/route.ts:84` | **Jedini API caller** |

#### Path 2 — `scheduleOrderTseStorno` (orphan: fire-and-forget, **bez** `storno_records`)

| Fajl:linija | Caller | Kontekst |
|-------------|--------|----------|
| `src/lib/fiscal/sign-transaction.ts:397-403` | Definicija | `void signOrderStornoById(...).catch(...)` |
| `src/lib/stripe/refund.ts:129-130` | `processRefund` | Ako `tse_signature && !skipTseStorno` |
| `src/lib/stripe/webhook.ts:255-261` | `charge.refunded` webhook | Dashboard refund sync |
| `src/app/api/orders/[orderId]/route.ts:444-445` | Staff **cancel** | Full order total storno |

**Dodatni calleri `processRefund` (indirektno → Path 2):**

| Fajl:linija | Kontekst |
|-------------|----------|
| `src/app/api/orders/[orderId]/route.ts:399` | Staff **reject** paid order |
| `src/app/api/orders/[orderId]/route.ts:429` | Staff **cancel** paid + Stripe |
| `src/app/api/orders/[orderId]/refund/route.ts:91` | Dedicated refund API |
| `src/lib/pos/inbound/handle-pos-order-cancelled.ts:89` | POS cancel + Stripe refund |

#### Path 3 — `signOrderStornoById` direktno (orphan, bez `storno_records`)

| Fajl:linija | Caller | Kontekst |
|-------------|--------|----------|
| `src/lib/fiscal/sign-transaction.ts:319` | Definicija | Load order → `signOrderStornoTransaction` |
| `src/lib/pos/inbound/handle-pos-order-cancelled.ts:130-132` | POS cancel | Samo ako `tse_signature && !refundedViaStripe` |

#### Path 4 — Internal helpers (ne entry points)

| Fajl:linija | Funkcija | Ko zove |
|-------------|----------|---------|
| `src/lib/fiscal/sign-transaction.ts:260` | `signOrderStornoTransaction` | `performStorno`, `signOrderStornoById` |
| `src/lib/fiscal/sign-transaction.ts:374` | `signOrderStornoById` body | `scheduleOrderTseStorno`, POS cancel |

#### Path 5 — `fiscal.abort` (AVBelegabbruch pre plaćanja)

**Ne postoji u kodu.** ADR-011 §6.2 predviđa ga; nema handler-a ni implementacije.

#### Dupli storno rizik

POS cancel sa Stripe refundom: `processRefund` → `scheduleOrderTseStorno` (Path 2), zatim guard `!refundedViaStripe` sprečava Path 3 (`handle-pos-order-cancelled.ts:130`). Ali Path 2 i dalje **nema audit trail**.

---

### 4. Da li postoji DB trigger koji BLOKIRA UPDATE na `orders` kad `tse_signature IS NOT NULL`?

**Odgovor: NE.** Nema migracije sa `guard_order_fiscal_immutability` ili sličnim triggerom.

Pretraga `supabase/migrations/`:

| Migration | Fajl:linija | Šta radi |
|-----------|-------------|----------|
| `00022_fiskaly_tse.sql` | `2-3` | Samo `ADD COLUMN tse_signature`, `tse_data` |
| `00084_storno_records.sql` | `9-33` | `storno_records` tabela |
| `00097_fiscal_journal.sql` | `22-66` | `fiscal_transactions` journal — **nema trigger na orders** |

ADR-011 §5.2 predlaže `00097_fiscal_immutability.sql` — **nije kreiran**. Staff može posle TSE sign-a menjati `payment_method`, `total`, itd. bez PG exception-a.

---

### 5. Da li je `fiskaly_tss_id` na `organizations` ili `locations`?

**Odgovor: na `organizations`.** Per-location register postoji samo u journal schema (`00097`), ne u runtime kodu.

| Fajl:linija | Dokaz |
|-------------|-------|
| `supabase/migrations/00023_fiskaly_per_org.sql:2-3` | `ALTER TABLE organizations ADD fiskaly_tss_id, fiskaly_client_id` |
| `src/lib/fiscal/sign-transaction.ts:150-176` | `loadOrgFiskalyConfig` — `SELECT ... FROM organizations` |
| `src/lib/fiscal/sign-transaction.ts:209-220` | TSE sign koristi `orgFiskaly.fiskaly_tss_id`, `fiskaly_client_id` |
| `src/lib/fiscal/provision-tss.ts:27-29` | `provisionFiskalyTss(organizationId)` — org-scoped |
| `src/lib/fiscal/provision-tss.ts:35-38` | `SELECT ... FROM organizations` |
| `src/lib/export/dsfinvk.ts:738-739` | DSFinV-K učitava `organizations.fiskaly_tss_id` |
| `supabase/migrations/00097_fiscal_journal.sql:4-17` | `fiscal_registers` — **1:1 sa location**, ali **nema TS koda koji je koristi** |

**Implikacija za multi-lokacijske organizacije:**

- Sve lokacije dele **jedan** Fiskaly TSS + jedan client → **jedna Kasse** u očima Finanzamta.
- §146a Abs. 4 Kassenmeldepflicht zahteva **registraciju po Einsatzort/Betriebsstätte** — multi-location org sa jednim TSS je **HIGH** compliance rizik.
- DSFinV-K koristi `location.id` kao `Z_KASSE_ID` (`dsfinvk.ts:792`, `948`) ali TSE_ID iz org — **interno nekonzistentno**.

---

### 6. Šta DSFinV-K export čita — `orders` ili `fiscal_transactions`?

**Odgovor: `orders` + `storno_records` + `daily_closings`.** **`fiscal_transactions` se ne koristi.**

| Izvor | Fajl:linija | Query |
|-------|-------------|-------|
| Daily closings | `src/lib/export/dsfinvk.ts:768-777` | `FROM daily_closings` |
| Orders (sales) | `src/lib/export/dsfinvk.ts:822-830` | `FROM orders` + `order_items` |
| Storno records | `src/lib/export/dsfinvk.ts:845-854` | `FROM storno_records` |
| Original orders za storno | `src/lib/export/dsfinvk.ts:879-884` | `FROM orders` (second query) |
| Org Fiskaly IDs | `src/lib/export/dsfinvk.ts:738-739` | `organizations.fiskaly_*` |

**Format iznosa:**

| Polje | Fajl:linija | Model |
|-------|-------------|-------|
| Line gross/net/ust | `src/lib/export/dsfinvk.ts:410` | `lineVatBreakdown(item.total, rate)` — gross-inclusive extraction |
| Storno sign multiplier | `src/lib/export/dsfinvk.ts:193-196` | `dsfinvkStornoSign` → -1 za storno bonove |
| Synthetic storno bon | `src/lib/export/dsfinvk.ts:159-190` | `buildStornoBonOrder` — ratio scaling od original order |
| Z_NR | `src/lib/export/dsfinvk.ts:784-787` | **Index u nizu closings** (`index + 1`), ne persistent `daily_closings.z_nr` |
| TSE_ID bug | `src/lib/export/dsfinvk.ts:361-362` | Koristi `tse.tss_serial` za **oba** `TSE_ID` i `TSE_SERIAL` — DSFinV-K očekuje UUID `tss_id` |

---

### 7. Da li `fiscal_transactions` iz migracije `00097` ima orchestrator?

**Odgovor: Samo schema, nema runtime koda.**

| Postoji | Fajl:linija |
|---------|-------------|
| `fiscal_registers` | `supabase/migrations/00097_fiscal_journal.sql:4-17` |
| `fiscal_transactions` | `supabase/migrations/00097_fiscal_journal.sql:22-66` |
| `fiscal_transaction_lines` | `supabase/migrations/00097_fiscal_journal.sql:82-94` |
| `fiscal_artifacts` | `supabase/migrations/00097_fiscal_journal.sql:96-105` |
| `fiscal_handoffs` | `supabase/migrations/00097_fiscal_journal.sql:107-117` |
| `daily_closings.fiscal_transaction_id`, `z_nr` | `supabase/migrations/00097_fiscal_journal.sql:123-128` |

| Ne postoji | Pretraga |
|------------|----------|
| `runFiscalPipeline` | 0 match u `src/**/*.ts` |
| `fiscal_transactions` u TS | 0 match |
| `finalize_fiscal_*` RPC | 0 match u migrations osim komentara u ADR |

---

### 8. Postoji li Kassenmeldepflicht UI / wizard / `fiscal_registrations`?

**Odgovor: NE.** Nema implementacije u kodu.

| Traženo | Rezultat |
|---------|----------|
| `fiscal_registrations` tabela | Samo u ADR-011 §8.1 — **nema migration** |
| `kassenmeldung` / `Kassenmeldepflicht` | 0 match u `src/` |
| `/admin/fiskal/meldung` | Ne postoji |
| ELSTER integracija | Ne postoji |

**Pravni kontekst:** Od 2025-01-01 obaveza prijave elektronickih evidencionih sistema Finanzamtu (§146a Abs. 4 AO). Bez wizard-a i export checklist-e, operator ne može legalno dokumentovati Inbetriebnahme.

---

## KORAK 3 — Architecture Decision

### 3.1 Target architecture (preporuka)

**Adopt ADR-012 as ceiling; ship ADR-011 hotfixes as Phase 0 gates.**

```
┌──────────────────────────────────────────────────────────────────┐
│  ORDER DOMAIN (mutable)          FISCAL DOMAIN (append-only)      │
│  orders, order_items, status     fiscal_registers (per location)  │
│  payment_status                  fiscal_transactions (journal)    │
│         │                        fiscal_transaction_lines         │
│         │  runFiscalPipeline()   fiscal_artifacts (beleg)         │
│         └──────────────────────► fiscal_handoffs (vorsystem)       │
│                    │                                              │
│                    ▼                                              │
│              outbox fiscal.*  →  Fiskaly TSE                      │
└──────────────────────────────────────────────────────────────────┘
```

**Single orchestrator rule:** Svi fiscal side-effect-i prolaze kroz `runFiscalPipeline(trigger)`. Nijedan `schedule*` fire-and-forget. Nijedan direktan `signOrderTransactionById(orderId)` iz API route-a.

**Strangler migration (ADR-012 §10):**

| Phase | Trajanje | Sadržaj |
|-------|----------|---------|
| **0 — Hotfix gates** | 2-3 PR-a, dani | FC-2, FC-4, FC-3 (timing, storno, beleg fields) — bez journal-a |
| **A — Dual write** | 2 PR-a, ≤14 dana | FJ-1 RPC + FJ-2 pipeline + FJ-3 handler na `fiscalTransactionId`; legacy `orders.tse_*` sync u istoj TX |
| **B — Flip reads** | 1-2 PR-a | DSFinV-K, admin UI, Beleg čitaju journal; ukloniti create-time TSE definitivno |
| **C — Deprecate legacy** | 1 PR, post-GA+30d | Stop dual-write; view `orders_with_fiscal` |

**Hard gate za DE standalone GA:** Phase A complete + Phase B complete + FJ-7 Kassenmeldepflicht wizard.

---

### 3.2 Gap register

#### BLOCKER

| ID | Gap | Dokaz (file:line) | Plan popravke |
|----|-----|-------------------|---------------|
| **G-B1** | TSE sign na order create (pre payment) | `build-outbox-events.ts:68-77` → `persist-order-side-effects.ts:84` → `emit-side-effects.ts:19-29` | **FC-2:** Ukloniti `fiscal.tse_sign` iz `buildOutboxEvents`. Ostaviti samo `buildPaymentCompletionEvents` (`order-saga.ts:64-70`) + cash settle path (`route.ts:476-491`, `bill/route.ts:354`). Ažurirati testove: `outbox.test.ts:29-33`, `pos-inbound.test.ts`. |
| **G-B2** | Orphan storno — 4 path-a bez `storno_records` | `sign-transaction.ts:397-403`; call sites `refund.ts:129-130`, `webhook.ts:255-261`, `route.ts:444-445`, `handle-pos-order-cancelled.ts:130-132` | **FC-4:** Obrišiti `scheduleOrderTseStorno`. Svi path-ovi → `performStorno` ili `runFiscalPipeline({ kind: "storno" })`. Webhook: dedupe preko `storno_records` / idempotency. `processRefund`: uvek `skipTseStorno: true`; TSE preko storno pipeline-a. Novi outbox handler `fiscal.storno` opciono za retry. |
| **G-B3** | Kassenmeldepflicht nedostaje (§146a Abs. 4, obavezno od 2025) | 0 match u `src/`; nema `fiscal_registrations` migration | **FJ-7 / FC-8:** Migration `fiscal_registrations`. Admin wizard `/admin/fiskal/meldung`. PDF/CSV checklist za ELSTER. Data iz `fiscal_registers` (kassen_id, tss_serial, Inbetriebnahme). |
| **G-B4** | Journal schema bez runtime-a | `00097_fiscal_journal.sql`; 0 TS orchestrator | **FJ-1 + FJ-2:** `run-fiscal-pipeline.ts`, `finalize_fiscal_sale` RPC, dual-write u Phase A. Bez ovoga nema structural GoBD readiness. |

#### HIGH

| ID | Gap | Dokaz | Plan popravke |
|----|-----|-------|---------------|
| **G-H1** | Nema immutability trigger na signed orders | Nema migration; ADR-011 §5.2 neimplementiran | **FC-5:** Nova migration `00103_fiscal_immutability.sql` — trigger na `orders` (subtotal, tax_amount, total, payment_method, tse_*). Trigger na `order_items` kad parent signed. Journal Phase B zamenjuje ovo append-only modelom. |
| **G-H2** | Org-scoped TSS (multi-location = jedna Kasse) | `00023_fiskaly_per_org.sql:2-3`; `provision-tss.ts:27-38`; `sign-transaction.ts:150-176` | **FC-6 / FJ-1:** Provision na `fiscal_registers` per location. `loadRegisterForLocation(locationId)`. Migration data backfill iz `organizations.fiskaly_*`. |
| **G-H3** | Beleg bez TSE start/end (KassenSichV §6) | `beleg.ts:79-80` koristi samo `createdAt`; nema `start_time`/`end_time` iz `tse_data` | **FC-3:** Proširiti `BelegTseData` + HTML/ESC-POS (`beleg.ts:198-214`, `appendBelegTseEscPos:234+`). Format de-DE iz `tse_data.start_time`, `end_time` (persistovano u `sign-transaction.ts:144-145`). |
| **G-H4** | DSFinV-K pogrešan `TSE_ID`, sintetički Z_NR | `dsfinvk.ts:361-362` (serial umesto UUID); `784-787` (index, ne `z_nr`) | **FC-7 / FJ-6:** `TSE_ID` iz `tse_data.tss_id`. Persistent `daily_closings.z_nr` + journal `z_closing` rows. Rewrite query layer na `fiscal_transactions`. |
| **G-H5** | DSFinV-K čita orders, ne journal | `dsfinvk.ts:822-884` | **FJ-6:** Export samo iz `fiscal_transactions` + lines + registers. Ukloniti `buildStornoBonOrder` sintezu. |
| **G-H6** | Dupli TSE enqueue (create + payment) | Oba path-a aktivna; idempotency samo sprečava dupli Fiskaly poziv | Rešava se sa G-B1; dodatno gate u handler-u: `resolveFiscalMoment !== "never"` pre sign-a. Novi fajl `resolve-fiscal-moment.ts`. |

#### MEDIUM

| ID | Gap | Dokaz | Plan popravke |
|----|-----|-------|---------------|
| **G-M1** | `fiscal.abort` ne postoji | ADR-011 §6.2; nema koda | Novi handler `src/lib/outbox/handlers/abort.ts`. Fiskaly `receipt_type: CANCELLATION` za reject pre pay. Bez `storno_records`. |
| **G-M2** | Manual TSE job van outbox-a | `jobs/tse-sign/route.ts:28` | Deprecate ili ograničiti na DLQ replay sa `fiscalTransactionId`. |
| **G-M3** | POS disconnect policy | ADR-011 §5.1 — neimplementirano | Audit log + owner email na POS disconnect. Optional `locations.fiscal_grace_until`. |
| **G-M4** | TSE reconciliation cron | ADR-011 FC-10 | `fiscal.reconcile` outbox event; Fiskaly `getTransaction` vs journal. |
| **G-M5** | GoBD retention runbook | ADR-011 §8.3 | `docs/compliance/gobd-retention.md`; exclude fiscal tables iz cleanup cron-a. |
| **G-M6** | Vorsystem handoff audit | `fiscal_handoffs` u 00097, 0 TS | **FJ-8:** Insert handoff na POS push success. Beleg disclaimer. |
| **G-M7** | Landing checkout demo net+tax | `checkout-showcase.tsx:16` | Kosmetika — ne fiscal blocker. |

---

### 3.3 Implementation order (šta prvo i zašto)

```
Phase 0 (legal hotfix — ship pre pilot GA)
├── PR-1: G-B1 (FC-2) — ukloni create-time TSE
│         Zašto prvo: najkraći path do legalnog fiscal moment-a; nema schema promene
├── PR-2: G-B2 (FC-4) — unified storno
│         Zašto drugo: orphan storno = TSE u Fiskaly bez audit trail-a (GoBD)
└── PR-3: G-H3 (FC-3) — Beleg mandatory fields
          Zašto treće: §146a Abs. 2 Belegausgabe; zavisi od ispravnog TSE moment-a

Phase A (structural — journal dual write)
├── PR-4: G-B4 + G-H2 (FJ-1) — RPC finalize + fiscal_registers provision
├── PR-5: G-H6 gate (FJ-2) — runFiscalPipeline; replace direct sign calls
└── PR-6: FJ-3 + FJ-4 — handler on fiscalTransactionId; artifacts table

Phase B (GA gate — flip reads)
├── PR-7: G-H1 (FC-5) — immutability trigger (parallel sa journal)
├── PR-8: G-H4 + G-H5 (FJ-6) — DSFinV-K from journal
└── PR-9: G-B3 (FJ-7) — Kassenmeldepflicht wizard

Phase C (post-GA)
├── PR-10: G-M1, G-M6 (abort + handoffs)
├── PR-11: G-M3, G-M4, G-M5 (ops hardening)
└── PR-12: FJ-10 — drop legacy orders.tse_* dual write
```

**Zašto ovaj redosled:**

1. **Timing pre strukture** — potpisivanje neplaćenih porudžbina je aktivna pravna povreda danas; ne treba čekati journal.
2. **Storno pre export-a** — DSFinV-K `bon_referenzen.csv` zahteva konzistentan storno audit; orphan path-ovi proizvode TSE bez `storno_records`.
3. **Journal pre GA** — Finanzamt pita za jedan ledger; `orders` kolone nisu append-only.
4. **Kassenmeldepflicht pre GA** — obaveza od 2025-01-01; bez wizard-a nema operativnog compliance surface-a.

---

### 3.4 New files (target layout)

```
src/lib/fiscal/
  resolve-fiscal-moment.ts       # NEW — G-H6 gate
  runtime/
    run-fiscal-pipeline.ts       # NEW — FJ-2 single entry
    finalize-fiscal-sale.ts      # NEW — RPC wrapper (TS side)
  provision-register.ts          # NEW — replaces org-scoped provision-tss.ts
  kassenmeldung.ts               # NEW — FJ-7 export/checklist

src/lib/outbox/
  build-outbox-events.ts         # EDIT — remove fiscal.tse_sign (G-B1)
  handlers/
    tse-sign.ts                  # EDIT — fiscalTransactionId payload (FJ-3)
    beleg.ts                     # EDIT — read fiscal_artifacts / journal
    storno.ts                    # NEW — retry wrapper (FC-4)
    abort.ts                     # NEW — G-M1

supabase/migrations/
  00103_fiscal_immutability.sql  # NEW — G-H1
  00104_finalize_fiscal_sale.sql # NEW — FJ-1 RPC
  00105_fiscal_registrations.sql # NEW — G-B3
  00106_backfill_fiscal_registers.sql # NEW — G-H2 data migration
```

---

### 3.5 Invariants — NIKAD ne smeju biti prekršene

| ID | Invariant | Enforcement |
|----|-----------|-------------|
| **F1** | Fiscal mode je **derived** — nema admin toggle | `resolveFiscalBehavior(posIntegration)` — `resolve-fiscal-behavior.ts:5-11` |
| **F2** | **Jedan VAT model** — gross-inclusive iz `vat.ts` | Svi TSE/Beleg/DSFinV-K/DATEV import iz `src/lib/tax/vat.ts` |
| **F3** | TSE **samo posle fiscal moment-a** — nikad na unpaid electronic order create | `resolveFiscalMoment` + outbox gate; **nema** `fiscal.tse_sign` u `buildOutboxEvents` |
| **F4** | **Jedan storno path** — svaki TSE storno → audit row sa linkom na original | `performStorno` / journal `storno_of_id`; **obrišiti** `scheduleOrderTseStorno` |
| **F5** | **Immutable posle sign-a** — nema UPDATE fiscal polja | PG trigger (FC-5) → journal append-only (ADR-012 F5) |
| **F6** | **Jedan register po lokaciji** — ne po organizaciji | `fiscal_registers.location_id UNIQUE` |
| **F7** | Artifacts **write-once** — beleg_snapshot, storno_records, fiscal_artifacts | Handler proverava `IF NOT EXISTS` pre insert-a |
| **F8** | **Vorsystem = zero Fiskaly calls** | `resolveFiscalBehavior === "vorsystem"` → `fiscal_handoffs` only |
| **F9** | **Jedan signed sale po order-u** | `idx_fiscal_one_signed_sale_per_order` (`00097:68-70`) |
| **F10** | **DSFinV-K čita samo journal** (Phase B+) | `generateDsfinvkExport` query na `fiscal_transactions` |
| **F11** | **Outbox payload = fiscalTransactionId** (Phase A+) | Ne `orderId` kao aggregate za fiscal domain |
| **F12** | **Nema fire-and-forget fiscal** — nema `schedule*` za TSE/storno | Commit-checklist §1; outbox + DLQ retry |
| **F13** | **Atomic fiscal + outbox** — nema commit-a bez oba | RPC `finalize_fiscal_*` u jednoj PG transakciji |
| **F14** | **Beleg u roku od poslovnog slučaja** — TSE pre Beleg, oba posle payment | Chain: `fiscal.tse_sign` → `fiscal.beleg` → `fiscal.send_receipt` |
| **F15** | **10-year retention** — no hard delete fiscal tables | GoBD; cron cleanup exclude |

---

### 3.6 Legal compliance checklist (šta Finanzamt očekuje vs as-built)

| Zahtev | Pravni izvor | As-built | Status |
|--------|--------------|----------|--------|
| TSE na svakom Geschäftsvorfall | §146a Abs. 1 AO, KassenSichV | Da, ali **pogrešan trenutak** za online | ❌ G-B1 |
| Belegausgabe neposredno posle transakcije | §146a Abs. 2 AO | Beleg chain postoji, ali može biti pre payment | ❌ G-B1 |
| Beleg: TSE start/end, serial, counter, Prüfwert | KassenSichV §6 | Delimično — nema start/end | ⚠️ G-H3 |
| Storno = novi TSE bon + referenca | DSFinV-K, GoBD | `performStorno` OK; orphan path-ovi ne | ❌ G-B2 |
| Kassenmeldepflicht | §146a Abs. 4 AO (od 2025) | Ne postoji | ❌ G-B3 |
| DSFinV-K export za Betriebsprüfung | KassenSichV Anlage | Postoji, ali buggy TSE_ID/Z_NR | ⚠️ G-H4 |
| Manipulationssicher, unveränderbar | GoBD, §146a | Nema trigger; nema journal runtime | ❌ G-H1, G-B4 |
| Jedna Kasse po Einsatzort | §146a Abs. 4, Meldung | Org-scoped TSS | ❌ G-H2 |
| 10 godina čuvanja | GoBD | Nema dokumentovanog runbook-a | ⚠️ G-M5 |

---

### 3.7 Testing gates (pre merge po fazi)

| Faza | Obavezni testovi |
|------|------------------|
| Phase 0 PR-1 | Online order: **no** `tse_signature` until `payment_status=paid`; cash: TSE only after saga |
| Phase 0 PR-2 | Full/partial storno → exactly one `storno_records` row; no `scheduleOrderTseStorno` grep |
| Phase 0 PR-3 | Beleg HTML contains TSE start + end timestamps |
| Phase A | Dual-write: journal row + `orders.tse_*` identical; idempotent retry |
| Phase B | DSFinV-K golden file vs IDEA sample; zero divergence cron 7 days |
| GA | Kassenmeldepflicht wizard exports valid checklist; pilot location registered |

Commands: `pnpm test:run`, `pnpm type-check`, `pnpm lint`, `pnpm build` + manual IDEA import on staging.

---

### 3.8 Explicit non-goals (ne raditi)

- Manual `fiscal_mode` admin toggle
- Fiskaly pozivi u vorsystem modu
- `schedule*` fire-and-forget za TSE/storno
- UPDATE na signed `fiscal_transactions`
- DSFinV-K export bez daily closings (warn, ne silent garbage)
- Big-bang rewrite `create-order.ts` ili order saga

---

## References

- [ADR-011 Fiscal Compliance Spine](./ADR-011-fiscal-compliance-spine.md)
- [ADR-012 Fiscal Journal Spine](./ADR-012-fiscal-journal-spine.md)
- [ADR-001 Implementation Warnings](./ADR-001-implementation-warnings.md)
- [Commit checklist — no duplicate side effects](../.cursor/rules/commit-checklist.mdc)
- BMF Schreiben 28.06.2024 / 03.03.2025 — §146a AEAO
- KassenSichV §6 — Pflichtangaben auf Beleg

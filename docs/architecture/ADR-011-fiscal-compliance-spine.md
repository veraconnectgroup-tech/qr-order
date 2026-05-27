# ADR-011: Fiscal Compliance Spine (KassenSichV / GoBD / §146a)

| Field | Value |
|-------|-------|
| **Status** | **Proposed** — tactical fixes; **structural ceiling:** [ADR-012](./ADR-012-fiscal-journal-spine.md) |
| **Date** | 2026-05-27 |
| **Based on** | Code audit 2026-05-27 (12 fiscal modules traced end-to-end) |
| **Depends on** | [ADR-001](./ADR-001-universal-ordering-platform.md) · outbox spine (A1–A8) · fiskaly integration (as-built) |
| **Legal scope** | KassenSichV · GoBD · AO §146a (incl. Kassenmeldepflicht since 2026-01-01) |

---

## 0. One sentence

**Treat fiscal compliance as a single spine** — one VAT model, one TSE moment (payment completion), one storno path, one register per location, immutable after sign — wired through the existing outbox; vorsystem mode stays derived, never manual.

---

## 1. Problem (as-built audit)

The codebase has real fiscal plumbing (Fiskaly, Beleg, Z-Bon, Storno, DSFinV-K export). A Kassennachschau would still fail on:

| # | Gap | Root cause in code |
|---|-----|-------------------|
| 1 | TSE signs before payment | `buildOutboxEvents` enqueues `fiscal.tse_sign` at order **create** with `paymentStatus: "pending"` |
| 2 | Wrong amounts on Beleg / TSE / export | `vat.ts` uses **net + tax on top**; Beleg, Fiskaly schema, DSFinV-K treat line totals as **gross** |
| 3 | Orphan storno TSE transactions | `scheduleOrderTseStorno` (cancel/refund/webhook) bypasses `performStorno` / `storno_records` |
| 4 | Mutable fiscal records | No DB guard after `tse_signature`; staff can change `payment_method` post-sign |
| 5 | Kassenmeldepflicht missing | Zero ELSTER / registration flow |
| 6 | DSFinV-K not audit-ready | Wrong `TSE_ID`, missing files, Z_NR not persistent, export requires pre-built closings |
| 7 | One TSS per org | Multi-location orgs share one Fiskaly client — wrong for per-Kasse Meldung |

**Non-goal:** Rewrite ADR-001 ordering/outbox spine. Extend it with fiscal invariants and targeted fixes.

---

## 2. Decision — Fiscal Compliance Spine

Five layers. Upper layers depend on lower; do not ship standalone GA until Layer 1–3 are green.

```
┌─────────────────────────────────────────────────────────────┐
│ L5  Compliance surface                                      │
│     Kassenmeldepflicht UI · DSFinV-K export · Z-Bon history │
├─────────────────────────────────────────────────────────────┤
│ L4  Artifacts                                               │
│     Beleg (HTML/ESC-POS) · Z-Bon · DATEV (accounting only)  │
├─────────────────────────────────────────────────────────────┤
│ L3  Fiscal transactions                                     │
│     TSE sign · Storno · Daily closing sign                  │
├─────────────────────────────────────────────────────────────┤
│ L2  Fiscal gate                                             │
│     resolveFiscalBehavior · resolveFiscalMoment · immutability│
├─────────────────────────────────────────────────────────────┤
│ L1  Money truth (single source)                             │
│     Gross-inclusive VAT · frozen line snapshots on order    │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 Invariants (enforce in code + DB)

| ID | Invariant | Enforcement |
|----|-----------|-------------|
| **F1** | Fiscal mode is **derived** only | `resolveFiscalBehavior(posIntegration)` — no admin toggle |
| **F2** | **One VAT model** everywhere | `src/lib/tax/vat.ts` → all totals, TSE schema, Beleg, DSFinV-K |
| **F3** | TSE signs at **fiscal moment**, not create | See §3 — never enqueue `fiscal.tse_sign` on unpaid electronic orders |
| **F4** | **One storno path** | All cancellations/refunds → `performStorno` or `fiscal.abort` — delete `scheduleOrderTseStorno` |
| **F5** | **Immutable after sign** | PG trigger blocks fiscal field updates when `tse_signature IS NOT NULL` |
| **F6** | **One register per location** | TSS + Fiskaly client on `locations` (or `fiscal_registers`), not `organizations` |
| **F7** | Artifacts are **append-only** | `storno_records`, `daily_closings`, `beleg_snapshot` write-once |
| **F8** | Vorsystem → **zero** fiskaly calls | Same as ADR-001; worker double-checks `resolveFiscalBehavior` |

---

## 3. Fiscal moment — when TSE runs

**Definition:** The fiscal moment is when the economic transaction is **completed** from the Kasse's perspective.

```typescript
// src/lib/fiscal/resolve-fiscal-moment.ts (NEW)

export type FiscalMoment =
  | "payment_confirmed"   // Stripe webhook / saga → paid
  | "cash_confirmed"      // staff marks paid / pay at bar settled
  | "pos_fiscal_export"   // vorsystem — never QR Order TSE
  | "never";              // approval pending, rejected before pay

export function resolveFiscalMoment(order: {
  paymentStatus: string;
  paymentMethod: string;
  status: string;
  posIntegration: PosIntegrationContext | null;
}): FiscalMoment {
  if (resolveFiscalBehavior(order.posIntegration) === "vorsystem") {
    return "pos_fiscal_export";
  }
  if (order.status === "rejected" || order.status === "cancelled") {
    return "never";
  }
  if (order.paymentStatus !== "paid") {
    // Exception: pure cash/at_bar with immediate settlement policy (see below)
    if (
      isImmediateCashSettlement(order.paymentMethod) &&
      order.paymentStatus === "pending"
    ) {
      return "cash_confirmed"; // only when location policy = settle on accept
    }
    return "never";
  }
  return "payment_confirmed";
}
```

### 3.1 Outbox matrix (corrected)

| Event | When | Removed from |
|-------|------|--------------|
| `fiscal.tse_sign` | `resolveFiscalMoment !== "never"` **and** standalone | **`buildOutboxEvents` on create** |
| `fiscal.beleg` | Chained after successful TSE sign | unchanged |
| `fiscal.send_receipt` | After beleg + guest email | unchanged |
| `fiscal.z_bon` | Cron / manual daily close | unchanged |
| `fiscal.storno` | **NEW** — replaces fire-and-forget storno | cancel/refund/webhook paths |

**Payment completion path (already exists, becomes primary):**

```
order-saga / Stripe webhook → payment_status = paid
  → buildPaymentCompletionEvents()
  → fiscal.tse_sign (standalone only)
  → handleFiscalTseSign → signOrderTransactionById
  → fiscal.beleg → beleg_token + beleg_snapshot
  → fiscal.send_receipt (optional)
```

**Cash / at_bar path:**

```
Staff marks paid OR accept-with-immediate-cash policy
  → enqueue fiscal.tse_sign (same handler chain)
```

**Delete duplicate create-time sign:**

```diff
// src/lib/outbox/build-outbox-events.ts
- if (resolveFiscalBehavior(ctx.posIntegration) === "standalone") {
-   events.push({ event_type: "fiscal.tse_sign", ... });
- }
```

Idempotent `signOrderTransactionById` (skip if `tse_signature`) stays — safe for retries.

### 3.2 Beleg timing

Beleg is issued **within seconds** of fiscal moment via outbox chain — acceptable for §146a Abs. 2 **if and only if** TSE runs after payment. Target SLA: p95 < 5s from `payment_status=paid` to `beleg_token` set.

---

## 4. Layer 1 — Money truth (gross-inclusive VAT)

**Decision:** Menu prices and `order_items.total` are **gross (inkl. MwSt)** — standard for DE B2C hospitality.

```typescript
// src/lib/tax/vat.ts — REPLACE exclusive model

export function grossToNet(gross: number, taxRate: number): number {
  return roundMoney(gross / (1 + taxRate / 100));
}

export function grossTaxAmount(gross: number, taxRate: number): number {
  return roundMoney(gross - grossToNet(gross, taxRate));
}

export function calculateOrderTaxFromItems(items: Array<{ lineTotal: number; taxRate: number }>) {
  const grossSubtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const byRate = groupGrossByRate(items);
  const taxAmount = sumExtractedTax(byRate);
  const total = grossSubtotal; // total IS gross — no tax added on top
  return { subtotal: grossSubtotal - taxAmount, taxAmount, total, ... };
}
```

**Consumers (must all import from `vat.ts`):**

| Consumer | Today | After |
|----------|-------|-------|
| Cart / checkout | net + tax | gross display, extracted breakdown |
| `sign-transaction.buildReceiptSchema` | mismatched item vs order total | sums match `order.total` |
| `beleg.groupByVatRate` | duplicate logic | call shared `groupGrossByRate` |
| `daily-closing` VAT summary | mixed models | same extraction |
| `dsfinvk.lineVatBreakdown` | local duplicate | import from `vat.ts` |
| DATEV export | gross assumption on wrong base | net revenue = extracted net |

**Migration note:** Existing orders keep stored amounts; exports flag pre-cutover date range in admin. No silent rewrite.

---

## 5. Layer 2 — Fiscal gate

### 5.1 Vorsystem vs standalone (unchanged semantics, add disconnect policy)

```typescript
// resolveFiscalBehavior — keep as-is
posIntegration?.status === "connected" → "vorsystem"
else → "standalone"
```

**POS disconnect (NEW):**

```
pos status: connected → disconnected
  1. INSERT audit_log (fiscal.mode_transition)
  2. NOTIFY owner (email/in-app): "QR Order is now Standalone Kasse — Kassenmeldepflicht prüfen"
  3. Optional: locations.fiscal_grace_until (24h) — still vorsystem for in-flight orders only
  4. Next new order → standalone + TSE at fiscal moment
```

No manual toggle. Grace is **operational buffer**, not a compliance bypass.

### 5.2 Immutability (PostgreSQL)

```sql
-- migration 00097_fiscal_immutability.sql

CREATE OR REPLACE FUNCTION guard_order_fiscal_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.tse_signature IS NOT NULL THEN
    IF NEW.subtotal IS DISTINCT FROM OLD.subtotal
       OR NEW.tax_amount IS DISTINCT FROM OLD.tax_amount
       OR NEW.total IS DISTINCT FROM OLD.total
       OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
       OR NEW.tse_signature IS DISTINCT FROM OLD.tse_signature
       OR NEW.tse_data IS DISTINCT FROM OLD.tse_data THEN
      RAISE EXCEPTION 'fiscal_immutable: order % signed by TSE', OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Separate trigger on `order_items` / `order_item_modifiers` when parent order is TSE-signed.

---

## 6. Layer 3 — Fiscal transactions

### 6.1 TSE sign (`sign-transaction.ts`)

Keep Fiskaly ACTIVE → FINISHED flow. Changes:

1. Build schema from **Layer 1** gross amounts — `amounts_per_vat_rate` sum = `amounts_per_payment_type` sum = `order.total`.
2. Persist `start_time`, `end_time`, `tx_id`, `tss_id`, `client_id`, `payment_method` in `tse_data` (already done).
3. Circuit breaker stays; failed sign → outbox retry — order remains unsigned, no beleg.

### 6.2 Storno — single spine

**Delete:** `scheduleOrderTseStorno`, direct `signOrderStornoById` from cancel/refund/webhook.

**New outbox event:** `fiscal.storno`

```typescript
// src/lib/fiscal/storno.ts — export enqueue helper

export async function enqueueFiscalStorno(
  admin: SupabaseClient,
  req: StornoRequest
): Promise<StornoResult> {
  // performStorno remains sync core; outbox wrapper for retries
  return performStorno(req);
}
```

| Path | Action |
|------|--------|
| Admin storno API | `performStorno` (unchanged) |
| Order cancel (was paid + TSE) | `performStorno` full amount |
| Stripe refund (dashboard) | webhook → `performStorno` if no matching `storno_records` |
| Partial refund | `performStorno` with `amount` |
| Pre-payment reject | **NEW** `fiscal.abort` → Fiskaly `receipt_type: "CANCELLATION"` (AVBelegabbruch), no `storno_records` |

Every storno TSE → row in `storno_records` with `original_tse_tx_id`, negative amounts, link for DSFinV-K `bon_referenzen.csv`.

### 6.3 Z-Bon / daily closing

Keep `computeDailyClosing` → `saveDailyClosing` → `signDailyClosingTse`.

Additions:

| Field | Purpose |
|-------|---------|
| `daily_closings.z_nr` | **Persistent** sequential per location (never reuse) |
| `daily_closings.tse_closing_data` | already stores TSE payload |

Z_NR allocation:

```sql
-- per location monotonic
SELECT COALESCE(MAX(z_nr), 0) + 1 FROM daily_closings WHERE location_id = $1;
```

Cron unchanged (yesterday, standalone locations only). Failed cron → alert + manual `POST /api/fiscal/daily-closing`.

---

## 7. Layer 4 — Artifacts

### 7.1 Beleg (`beleg.ts`)

Mandatory fields on HTML + ESC-POS:

| Field | Source |
|-------|--------|
| Business name + address | org + location |
| Issue date | `createdAt` (display) |
| **TSE start / end** | `tse_data.start_time`, `tse_data.end_time` formatted de-DE |
| Items + VAT per rate | Layer 1 breakdown |
| Payment type Bar/Unbar | `payment_method` at sign time (immutable) |
| TSE serial, counter, Prüfwert | full signature or "vollständig im QR-Code" + V0 QR |
| Transaction ref | Fiskaly `tx_id` or signature counter |

`beleg_snapshot` written once in `handleFiscalBeleg` — never updated after set.

### 7.2 DATEV

Accounting export only — not KassenSichV. Uses extracted **net** per rate from Layer 1. Storno/refund rows added in Track B4.

---

## 8. Layer 5 — Compliance surface

### 8.1 Kassenmeldepflicht (§146a Abs. 4)

New table `fiscal_registrations`:

```sql
CREATE TABLE fiscal_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id),
  org_id UUID NOT NULL REFERENCES organizations(id),
  kassen_id TEXT NOT NULL,           -- fiskaly client serial / our register id
  tss_serial TEXT NOT NULL,
  inbetriebnahme_at DATE NOT NULL,
  ausserbetriebnahme_at DATE,
  elster_kennung TEXT,               -- optional, user-entered after ELSTER submit
  status TEXT NOT NULL CHECK (status IN ('active', 'decommissioned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Admin wizard (`/admin/fiskal/meldung`):

1. Show derived Kassen-ID + TSS serial from provisioned register.
2. Collect Inbetriebnahme date + location address confirmation.
3. Export PDF checklist for ELSTER Formular Zeile 87 ff.
4. Decommission → TSS `DISABLED` via Fiskaly + `ausserbetriebnahme_at`.

Phase 1: structured export + checklist (no ELSTER API). Phase 2: ELSTER OAuth if justified.

### 8.2 DSFinV-K export

Keep ZIP builder in `src/lib/export/dsfinvk.ts`. Harden:

| Fix | Detail |
|-----|--------|
| `TSE_ID` | Use `tse_data.tss_id` (UUID), not serial |
| `Z_NR` | From `daily_closings.z_nr` |
| Missing CSVs | Add `allocation_groups.csv`, aggregate `vat.csv` per DSFinV-K 2.0 |
| File names | Align with IDEA import spec (rename `stamm_*` → spec names in ZIP) |
| Precondition | Admin UI warns: "Tagesabschlüsse fehlen für: …" before export |
| Validation | CI test: golden-file compare against IDEA sample import |

Consider fiskaly DSFinV-K API when provider responds (`docs/compliance/dsfinvk-provider-inquiry.md`).

### 8.3 GoBD retention

| Data | Policy |
|------|--------|
| `orders`, `order_items`, `storno_records`, `daily_closings`, `audit_log` | No hard delete; 10-year retention |
| Supabase | PITR + legal hold flag on org |
| Cron cleanup | **Exclude** fiscal tables (today webhook 30-day cleanup is OK) |

Document in `docs/compliance/gobd-retention.md` (ops runbook).

---

## 9. Register model — per location

Move from org-scoped to location-scoped Fiskaly IDs:

```
organizations
  └── locations
        └── fiscal_register (1:1 for standalone)
              fiskaly_tss_id
              fiskaly_client_id
              client_serial     -- Kassen-ID for Meldung
              provisioned_at
```

**Provision trigger:** location activated + standalone mode (no connected POS).

```typescript
// provisionFiskalyTss(locationId) — replaces org-scoped version
// Keep org-scoped IDs as fallback during migration, read location first
```

---

## 10. Code layout (target)

```
src/lib/fiscal/
  resolve-fiscal-moment.ts    # NEW — when to sign
  resolve-fiscal-behavior.ts  # MOVE from fulfillment/ (or re-export)
  vat-gross.ts                # optional split from tax/vat.ts
  sign-transaction.ts         # schema from Layer 1
  storno.ts                   # single path + abort
  beleg.ts                    # mandatory fields
  daily-closing.ts            # z_nr
  provision-tss.ts              # per location
  kassenmeldung.ts            # NEW — registration export
  fiskaly.ts                  # client unchanged

src/lib/export/
  dsfinvk.ts                  # hardened export
  datev.ts                    # net from Layer 1

src/lib/outbox/
  build-outbox-events.ts      # NO tse_sign on create
  handlers/
    tse-sign.ts
    beleg.ts
    storno.ts                 # NEW
    abort.ts                  # NEW — AVBelegabbruch

supabase/migrations/
  00097_fiscal_immutability.sql
  00098_location_fiscal_registers.sql
  00099_daily_closings_z_nr.sql
  00100_fiscal_registrations.sql
```

---

## 11. Implementation tracks

One PR per track. Standalone GA in DE blocked until **FC-1 + FC-2 + FC-3** ship.

| Track | Scope | Priority | Complexity |
|-------|-------|----------|------------|
| **FC-1** | Gross-inclusive VAT (`vat.ts` + all consumers) | P0 | L |
| **FC-2** | Fiscal moment — remove create-time TSE; wire cash-paid path | P0 | M |
| **FC-3** | Beleg mandatory fields (TSE start/end, payment, VAT fix) | P0 | S |
| **FC-4** | Unified storno — delete `scheduleOrderTseStorno`; `fiscal.storno` outbox | P1 | M |
| **FC-5** | DB immutability trigger | P1 | M |
| **FC-6** | Per-location register + migrate provision | P1 | L |
| **FC-7** | `z_nr` + DSFinV-K hardening + IDEA validation | P1 | L |
| **FC-8** | Kassenmeldepflicht wizard + `fiscal_registrations` | P0 legal | L |
| **FC-9** | POS disconnect policy + owner alert | P2 | M |
| **FC-10** | TSE reconciliation cron (`getTransaction`) | P2 | M |
| **FC-11** | GoBD retention runbook + RLS no-delete | P2 | M |

**Dependency graph:**

```
FC-1 ──► FC-3, FC-7, DATEV
FC-2 ──► FC-3 (beleg after correct moment)
FC-6 ──► FC-8 (Meldung needs per-location Kassen-ID)
FC-5 ── after FC-2 (sign timing stable)
FC-4 ── independent, but after FC-2 recommended
```

---

## 12. Testing — audit readiness

| Scenario | Test |
|----------|------|
| Online order | TSE **not** signed until Stripe `paid`; beleg within 5s after |
| Cash order | TSE on mark-paid only |
| VAT | 7% takeaway + 19% drink → Beleg net/brutto/tax matches `order.total` |
| Storno | Full + partial → one `storno_records` row; one TSE storno; DSFinV-K bon |
| Cancel unpaid | `fiscal.abort` CANCELLATION, no storno record |
| Immutability | UPDATE `orders.total` after sign → PG exception |
| DSFinV-K | Export month with closings → IDEA import green |
| Vorsystem | POS connected → zero fiskaly calls |
| Disconnect | POS disconnected → next order standalone + owner notified |

Commands: `pnpm test:run` (beleg, storno, dsfinvk, vat, outbox), manual IDEA import on staging.

---

## 13. What we explicitly do NOT do

- Manual `fiscal_mode` admin toggle
- fiskaly calls in vorsystem mode
- Fire-and-forget TSE/storno (`schedule*` pattern — delete per commit-checklist)
- Separate VAT math in Beleg / DSFinV-K / Fiskaly
- DSFinV-K export without daily closings (warn, don't silently export garbage)

---

## 14. Summary

| Layer | Delivers |
|-------|----------|
| **L1 Money truth** | Gross-inclusive VAT — one calculation |
| **L2 Gate** | Derived mode + fiscal moment + immutability |
| **L3 Transactions** | TSE · Storno · Z-Bon |
| **L4 Artifacts** | Beleg · DATEV |
| **L5 Compliance** | Kassenmeldepflicht · DSFinV-K · retention |

The outbox remains the hinge from ADR-001. This ADR fixes **when** and **what** gets enqueued for fiscal events, and **how** amounts are computed so TSE, Beleg, and export tell the same story to the Finanzamt.

---

## 15. Upgrade path

ADR-011 patches the as-built model (TSE on `orders`, triggers, multi-table export). For Finanzamt-ready structure, implement [ADR-012](./ADR-012-fiscal-journal-spine.md):

- **Hotfix track:** FC-1 + FC-2 + FC-3 from §11 (days)
- **GA track:** FJ-1…FJ-7 from ADR-012 (weeks, strangler migration)

---

## 16. References

- Audit source: conversation 2026-05-27 (12 modules, call-site traced)
- **[ADR-012 Fiscal Journal](./ADR-012-fiscal-journal-spine.md)** — preferred long-term architecture
- [ADR-001 §8](./ADR-001-universal-ordering-platform.md) — vorsystem / standalone
- [dsfinvk-provider-inquiry.md](../compliance/dsfinvk-provider-inquiry.md)
- As-built: `src/lib/fiscal/*`, `src/lib/export/dsfinvk.ts`, outbox handlers

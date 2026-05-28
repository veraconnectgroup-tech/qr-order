# ADR-012: Fiscal Journal Spine (v2 — supersedes ADR-011 layering)

| Field | Value |
|-------|-------|
| **Status** | **Proposed** — preferred target over [ADR-011](./ADR-011-fiscal-compliance-spine.md) |
| **Date** | 2026-05-27 |
| **Depends on** | [ADR-001](./ADR-001-universal-ordering-platform.md) · [ADR-009](./ADR-009-atomic-turn-commercial-spine.md) · outbox spine |
| **Supersedes** | ADR-011 **implementation approach** (keep ADR-011 audit findings + invariants F1–F8) |

---

## 0. One sentence

**Orders handle kitchen and payment; a separate append-only fiscal journal handles law** — one orchestrator (`runFiscalPipeline`), one gross-VAT calculator, one ledger row per TSE bon — so DSFinV-K, Beleg, and GoBD read the same table the Finanzamt would ask for.

---

## 1. Why ADR-011 is not enough

ADR-011 fixes timing, VAT, and storno paths **inside the order model**. That works short-term but keeps three structural weaknesses:

| Weakness | Risk |
|----------|------|
| **TSE lives on `orders`** | Kitchen can need order patches; fiscal immutability fights fulfillment |
| **Fiscal moment scattered** | saga + webhook + staff route + outbox each decide when to sign |
| **Export joins orders + storno_records + daily_closings** | Drift, duplicate logic, DSFinV-K bugs when one source differs |
| **Immutability = PG trigger on orders** | Blocks legitimate ops fields; easy to bypass via items table |
| **Beleg snapshot on `orders.beleg_snapshot`** | Legal artifact mixed with operational row |

**Pattern we already trust:** ADR-009 separated Denis **commercial truth** (`denis_timeline`, RPC finalize) from chat adapter code. Fiscal deserves the same.

---

## 2. Decision — Fiscal Journal

Two bounded contexts:

```
┌─────────────────────────────┐     ┌──────────────────────────────┐
│  ORDER DOMAIN               │     │  FISCAL DOMAIN               │
│  (mutable ops)              │     │  (append-only legal record)  │
├─────────────────────────────┤     ├──────────────────────────────┤
│  orders, order_items        │     │  fiscal_registers            │
│  payment_status, status     │────►│  fiscal_transactions         │
│  kitchen, POS push          │     │  fiscal_transaction_lines    │
│                             │     │  fiscal_artifacts            │
└─────────────────────────────┘     │  fiscal_registrations        │
                                      └──────────────────────────────┘
           │                                      │
           │         runFiscalPipeline()          │
           └──────────────────┬───────────────────┘
                              ▼
                    outbox (fiscal.* events)
                              ▼
                         fiskaly TSE
```

**Rule:** After a `fiscal_transactions` row exists with `status = signed`, **nothing in the fiscal domain is UPDATEd** — only new compensating rows (storno, abort).

Orders may still change `status` (preparing → ready) **after** sign; the ledger row is frozen.

---

## 3. Core model

### 3.1 `fiscal_registers` (aggregate root per Kasse)

One row per **standalone location** (vorsystem locations have no register row).

```sql
CREATE TABLE fiscal_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  location_id UUID NOT NULL UNIQUE REFERENCES locations(id),
  kassen_id TEXT NOT NULL,              -- client serial for Kassenmeldepflicht
  fiskaly_tss_id TEXT NOT NULL,
  fiskaly_client_id TEXT NOT NULL,
  tss_serial TEXT,
  provisioned_at TIMESTAMPTZ NOT NULL,
  decommissioned_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('active', 'decommissioned'))
);
```

TSS provision moves here from `organizations.*`. Multi-location = multi-register (correct for §146a).

### 3.2 `fiscal_transactions` (the journal)

Every TSE-relevant bon is **one row**. Types mirror DSFinV-K `BON_TYP`:

```sql
CREATE TYPE fiscal_tx_type AS ENUM (
  'sale',           -- Beleg
  'storno',         -- Stornobeleg (negative)
  'abort',          -- AVBelegabbruch
  'z_closing'       -- Kassenabschluss / Z-Bon
);

CREATE TYPE fiscal_tx_status AS ENUM (
  'pending',        -- intent created, TSE not yet called
  'signing',        -- worker in flight
  'signed',         -- TSE response stored — immutable
  'failed',         -- terminal; ops alert
  'skipped'         -- vorsystem handoff — no TSE
);

CREATE TABLE fiscal_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  register_id UUID NOT NULL REFERENCES fiscal_registers(id),
  org_id UUID NOT NULL,
  location_id UUID NOT NULL,

  tx_type fiscal_tx_type NOT NULL,
  status fiscal_tx_status NOT NULL DEFAULT 'pending',

  -- Link to order domain (nullable for z_closing)
  order_id UUID REFERENCES orders(id),
  source_order_id UUID REFERENCES orders(id),  -- storno → original sale
  -- Storno MUST reference the original signed journal entry (not orders.id alone)
  storno_of_id UUID REFERENCES fiscal_transactions(id),

  -- Frozen money snapshot (gross-inclusive, from vat.ts at finalize time)
  currency TEXT NOT NULL DEFAULT 'EUR',
  gross_total NUMERIC(12,2) NOT NULL,
  net_total NUMERIC(12,2) NOT NULL,
  tax_total NUMERIC(12,2) NOT NULL,
  payment_method TEXT NOT NULL,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('CASH', 'NON_CASH')),

  -- TSE payload (null until signed)
  fiskaly_tx_id TEXT,
  tse_signature TEXT,
  tse_data JSONB,
  signature_counter INT,
  tse_start TIMESTAMPTZ,
  tse_end TIMESTAMPTZ,

  -- Sequencing
  bon_number INT,                    -- per-register sequential (DSFinV-K BON_NR)
  z_nr INT,                          -- set when day closed

  business_date DATE NOT NULL,       -- location TZ
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  signed_at TIMESTAMPTZ,

  idempotency_key TEXT NOT NULL,
  UNIQUE (register_id, idempotency_key)
);
```

**Deprecate on `orders`:** `tse_signature`, `tse_data`, `beleg_token`, `beleg_snapshot`, `has_storno`, `storno_total` → read via join / view during migration.

### 3.3 `fiscal_transaction_lines`

Normalized VAT lines — **single source for Beleg, Fiskaly schema, DSFinV-K lines.csv**:

```sql
CREATE TABLE fiscal_transaction_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_transaction_id UUID NOT NULL REFERENCES fiscal_transactions(id),
  line_no INT NOT NULL,
  product_name TEXT NOT NULL,
  quantity NUMERIC(10,3) NOT NULL,
  tax_rate NUMERIC(5,2) NOT NULL,
  gross NUMERIC(12,2) NOT NULL,
  net NUMERIC(12,2) NOT NULL,
  tax NUMERIC(12,2) NOT NULL,
  UNIQUE (fiscal_transaction_id, line_no)
);
```

### 3.4 `fiscal_artifacts`

Beleg / Z-Bon HTML snapshots — content-addressed, write-once:

```sql
CREATE TABLE fiscal_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_transaction_id UUID NOT NULL UNIQUE REFERENCES fiscal_transactions(id),
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('beleg_html', 'z_bon_html')),
  content_hash TEXT NOT NULL,
  payload JSONB NOT NULL,            -- BelegData or ZBonDisplayData
  public_token UUID UNIQUE,          -- beleg URL token
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.5 Vorsystem handoff (NEW — ADR-011 gap)

When `resolveFiscalBehavior === 'vorsystem'`, no TSE — but GoBD still wants traceability:

```sql
CREATE TABLE fiscal_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id),
  location_id UUID NOT NULL,
  pos_provider TEXT NOT NULL,
  pos_external_id TEXT,
  pos_receipt_ref TEXT,              -- if POS returns fiscal ref
  handed_off_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);
```

Admin disclaimer Beleg: „Zahlung und Kassenbeleg über Ihr POS-System (Ref: …)".

---

## 4. Single orchestrator — `runFiscalPipeline`

Mirrors `runDenisTurn` / `finalize_denis_turn_metering`:

```typescript
// src/lib/fiscal/runtime/run-fiscal-pipeline.ts

export type FiscalTrigger =
  | { kind: "payment_settled"; orderId: string }
  | { kind: "cash_settled"; orderId: string; staffId: string }
  | { kind: "storno"; orderId: string; amount?: number; reason: string; staffId: string }
  | { kind: "abort"; orderId: string; reason: string }
  | { kind: "daily_close"; locationId: string; businessDate: string };

export async function runFiscalPipeline(
  admin: SupabaseClient,
  trigger: FiscalTrigger
): Promise<{ fiscalTransactionId: string | null; skipped: boolean }> {
  // 1. Load order + location + register + posIntegration
  // 2. resolveFiscalBehavior → vorsystem? handoff + return skipped
  // 3. resolveFiscalIntent(trigger) → sale | storno | abort | z_closing | none
  // 4. RPC finalize_fiscal_transaction (atomic):
  //      INSERT fiscal_transactions (pending) + lines from order snapshot
  //      INSERT outbox fiscal.tse_sign { fiscalTransactionId }
  // 5. Return id
}
```

**Only callers:**

| Caller | Trigger |
|--------|---------|
| `order-saga` payment complete | `payment_settled` |
| Staff mark-paid | `cash_settled` |
| Storno API | `storno` |
| Reject before pay (signed abort edge) | `abort` |
| Daily closing cron | `daily_close` |

**Delete:** direct `signOrderTransactionById(orderId)` from handlers — handler signs **`fiscalTransactionId`**.

### 4.1 Atomic RPC

```sql
-- finalize_fiscal_sale(order_id, idempotency_key) → fiscal_transaction_id
-- Single transaction:
--   1. Lock order + register
--   2. Assert payment settled (or cash policy)
--   3. Assert no existing signed sale for order
--   4. Compute lines via shared vat functions (gross-inclusive)
--   5. INSERT fiscal_transactions + lines (pending)
--   6. INSERT outbox fiscal.tse_sign
--   7. RETURN fiscal_transaction_id
```

No fiscal row + no outbox row without the other.

---

## 5. Outbox handlers (revised)

| Event | Payload | Handler action |
|-------|---------|----------------|
| `fiscal.tse_sign` | `{ fiscalTransactionId }` | Load journal row → Fiskaly → UPDATE status signed + tse_* |
| `fiscal.beleg` | `{ fiscalTransactionId }` | Build HTML from lines → `fiscal_artifacts` |
| `fiscal.send_receipt` | `{ fiscalTransactionId, email }` | Email with artifact token |
| `fiscal.storno` | `{ fiscalTransactionId }` | Same as tse_sign (negative schema) — **or** merged into one handler |
| `fiscal.reconcile` | `{ registerId, fromCounter, toCounter }` | Nightly Fiskaly vs journal |

**Aggregate ID:** `fiscal_transactions.id` (not `orders.id`).

Chain after sign:

```
fiscal.tse_sign → success → fiscal.beleg → fiscal.send_receipt?
```

---

## 6. Layer 1 — Money truth (unchanged from ADR-011)

Gross-inclusive VAT in `src/lib/tax/vat.ts`. **Only** `finalize_fiscal_*` RPC and `runFiscalPipeline` call it for fiscal rows.

Orders keep operational totals for kitchen/display; at fiscal finalize, **copy frozen snapshot** into journal lines. If order totals drift before finalize, pipeline uses **current order state at payment moment** — not create-time.

---

## 7. DSFinV-K — export from journal only

```typescript
// src/lib/export/dsfinvk.ts — rewrite query layer

export async function generateDsfinvkExport(...) {
  // SELECT FROM fiscal_transactions ft
  // JOIN fiscal_transaction_lines
  // JOIN fiscal_registers
  // JOIN daily_closings ON business_date (for Z_NR)
  // WHERE ft.status = 'signed'
  // Storno: ft.tx_type = 'storno' AND storno_of_id → bon_referenzen
}
```

**Benefits:**

- No synthetic `buildStornoBonOrder` from orders
- `BON_TYP` from `tx_type` enum mapping
- `TSE_ID` from `tse_data.tss_id` on journal row
- IDEA validation against stable schema

---

## 8. Z-Bon / daily closing — journal is source of truth

**Rule:** The signed `fiscal_transactions` row with `tx_type = 'z_closing'` is the **legal Z-Bon record**. There must not be two independent sources (computed closing table vs TSE).

```
computeDailyClosing (aggregate helper — read-only math)
  → runFiscalPipeline({ kind: "daily_close", ... })
  → INSERT fiscal_transactions (z_closing, pending) + lines + z_nr
  → outbox fiscal.tse_sign
  → handler signs → status = signed
  → UPSERT daily_closings AS READ MODEL copied from signed journal row
```

| Table | Role after ADR-012 |
|-------|-------------------|
| `fiscal_transactions` (`z_closing`) | **Source of truth** — TSE payload, Z_NR, amounts |
| `daily_closings` | **Denormalized projection** for admin UI; `fiscal_transaction_id` FK required |

DSFinV-K `cashpointclosing.csv` reads **only** signed `z_closing` journal rows — never a orphan `daily_closings` row without journal link.

Z_NR allocated in the same RPC as the `z_closing` journal insert (monotonic per register).

---

## 9. Invariants (ADR-011 F1–F8 retained + new)

| ID | Invariant |
|----|-----------|
| F1–F2 | Derived mode + one VAT model (ADR-011) |
| F3 | TSE only via `runFiscalPipeline` after settle — never on order create |
| F4 | Storno = new journal row; **`storno_of_id` FK → signed sale journal row** (never order_id alone) |
| F5 | **Journal append-only** — replaces order triggers |
| F6 | Register per location |
| F7 | Artifacts write-once in `fiscal_artifacts` |
| F8 | Vorsystem → `fiscal_handoffs`, zero TSE |
| **F9** | **One signed sale per order** — UNIQUE partial index |
| **F10** | **DSFinV-K reads journal only** |
| **F11** | **Outbox payload references fiscal_transaction_id** |

---

## 10. Migration strategy (strangler)

Do not big-bang. Three phases with **hard gates**.

### Phase A — Dual write (max 2 PRs, **≤14 days**)

1. Create journal tables + `finalize_fiscal_*` RPC.
2. TSE handler: sign journal row **and** legacy `orders.tse_*` in **one PG transaction** after Fiskaly returns (or RPC rolls back journal `signing` state).
3. Beleg reads journal first, falls back to order columns.

**Dual-write hazard (mandatory):**

```
❌ WRONG:  INSERT journal → commit → call Fiskaly → UPDATE orders.tse_*
✅ RIGHT:  RPC inserts journal (pending) + outbox in one TX
           Handler: Fiskaly → UPDATE journal signed + orders.tse_* in one TX
           On Fiskaly failure: journal stays pending/failed, orders untouched
```

If journal and legacy row diverge, reconciliation cron blocks Phase B.

### Phase B — Flip reads (**required before DE standalone GA**)

Gate: zero divergence alerts for 7 days in pilot locations.

1. DSFinV-K + admin fiscal UI read journal only.
2. Remove `fiscal.tse_sign` from `buildOutboxEvents` (ADR-011 FC-2).
3. All entry points → `runFiscalPipeline` only.

**Hard deadline:** Phase B merges before any DE standalone GA tag — no exception.

### Phase C — Deprecate columns (1 PR, post-GA+30d)

1. Stop dual write to `orders.tse_*`.
2. View `orders_with_fiscal` for dashboard badges.

---

## 11. Implementation tracks (replaces ADR-011 FC-*)

| Track | Scope | Replaces |
|-------|-------|----------|
| **FJ-1** | Journal schema + RPC + gross VAT | FC-1 + FC-6 foundation |
| **FJ-2** | `runFiscalPipeline` + payment/cash triggers | FC-2 |
| **FJ-3** | TSE handler on `fiscalTransactionId` | FC-2 + FC-3 |
| **FJ-4** | Artifacts + Beleg from journal | FC-3 |
| **FJ-5** | Storno/abort as journal rows | FC-4 |
| **FJ-6** | DSFinV-K from journal | FC-7 |
| **FJ-7** | Kassenmeldepflicht on `fiscal_registers` | FC-8 |
| **FJ-8** | Vorsystem handoffs | new |
| **FJ-9** | Reconciliation cron | FC-10 |
| **FJ-10** | Drop legacy order fiscal columns | cleanup |

**GA gate:** FJ-1 + FJ-2 + FJ-3 + FJ-4 + FJ-7.

---

## 12. Comparison

| Dimension | ADR-011 | ADR-012 (this) |
|-----------|---------|----------------|
| Legal record location | `orders` columns | `fiscal_transactions` journal |
| Immutability | PG triggers on orders | Append-only journal |
| Entry point | Multiple + outbox | `runFiscalPipeline` only |
| DSFinV-K source | 3-table join | Journal only |
| Order ops after sign | Fights immutability | Unrestricted |
| Vorsystem audit trail | Disclaimer only | `fiscal_handoffs` |
| Matches ADR-009 pattern | No | Yes (spine + RPC) |
| Migration cost | Lower | Higher (strangler) |
| Kassennachschau readiness | Good fixes | **Structural** |

---

## 13. What we still do NOT do

- Manual fiscal mode toggle
- fiskaly in vorsystem
- `schedule*` fire-and-forget fiscal calls
- UPDATE on signed `fiscal_transactions`
- DSFinV-K from `orders.tse_data` after Phase B

---

## 14. Recommendation

| Situation | Use |
|-----------|-----|
| Hotfix before pilot (days) | ADR-011 FC-1 + FC-2 + FC-3 only |
| **DE standalone GA / Finanzamt-ready** | **ADR-012 (this document)** |
| Long-term maintenance | ADR-012 — journal is the product |

ADR-011 remains valid as **audit + quick fixes**. ADR-012 is the **architecture ceiling**.

---

## 15. References

- [ADR-011](./ADR-011-fiscal-compliance-spine.md) — audit findings, VAT model, invariants
- [ADR-009](./ADR-009-atomic-turn-commercial-spine.md) — spine pattern template
- Code audit 2026-05-27

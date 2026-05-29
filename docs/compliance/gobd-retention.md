# GoBD Retention — Fiscal Records

| Field | Value |
|-------|-------|
| **Scope** | QR Order fiscal spine (KassenSichV / GoBD) |
| **Retention** | **10 years** minimum (§147 AO, GoBD) |
| **References** | [ADR-011](../architecture/ADR-011-fiscal-compliance-spine.md) · [ADR-012](../architecture/ADR-012-fiscal-journal-spine.md) |

## Immutable tables (never auto-delete)

These tables are append-only legal records. **No cleanup cron may touch them:**

| Table | Content |
|-------|---------|
| `fiscal_transactions` | Signed TSE journal (sale, storno, z_closing, abort) |
| `fiscal_transaction_lines` | VAT line snapshots |
| `fiscal_artifacts` | Beleg / Z-Bon HTML payloads |
| `fiscal_handoffs` | Vorsystem POS fiscal handoff audit |
| `fiscal_registers` | Per-location Kasse register |
| `fiscal_registrations` | Kassenmeldepflicht metadata |
| `storno_records` | Storno audit trail |
| `daily_closings` | Z-Bon read model (linked via `fiscal_transaction_id`) |
| `orders` (fiscal columns) | Legacy dual-write until Phase C deprecation |
| `audit_log` | Fiscal reconcile mismatches (`action = fiscal`) |

## Operational exports

Store DSFinV-K ZIP exports and signed Z-Bon HTML outside the app if required by tenant policy:

- Admin → Tagesabschluss → DSFinV-K export
- Z-Bon PDF/HTML per closing

Recommended: object storage bucket with lifecycle **≥ 10 years**, encrypted at rest.

## Cron jobs

| Cron | Path | Touches fiscal? |
|------|------|-----------------|
| Session cleanup | `/api/cron/cleanup` | **No** — only `table_sessions`, `webhook_events` |
| Daily closing | `/api/cron/daily-closing` | **Writes** `daily_closings` + journal `z_closing` |
| Fiscal reconcile | `/api/cron/fiscal-reconcile` | **Read-only** journal vs Fiskaly |

## Reconciliation

Nightly `/api/cron/fiscal-reconcile` compares signed journal rows with Fiskaly API.
Mismatches are logged and written to `audit_log` with `action = fiscal`.

**Staging verification:** [fiscal-smoke-checklist.md](./fiscal-smoke-checklist.md)

## Tenant offboarding

Before deleting an organization:

1. Export DSFinV-K for full retention period
2. Export `fiscal_transactions` + lines (SQL or admin tool)
3. Retain Fiskaly TSS archive per Fiskaly contract
4. Only then soft-delete org — **do not hard-delete fiscal rows** without legal review

## Phase C target

After GA+30d, reads flip to journal-only; `orders.tse_*` columns become deprecated but
retained for the 10-year window.

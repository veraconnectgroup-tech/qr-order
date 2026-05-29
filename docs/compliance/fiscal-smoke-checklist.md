# Fiscal Smoke Checklist (Staging)

Run after applying migrations `00104`–`00109` and deploying the fiscal track.

## Prerequisites

- [ ] Fiskaly sandbox credentials in env (`FISKALY_API_KEY`, `FISKALY_API_SECRET`)
- [ ] Org TSE provisioned: Admin → Settings → TSE aktivieren
- [ ] Per-location register: `POST /api/fiscal/provision` with `{ "locationId": "..." }`
- [ ] Migrations applied: `pnpm db:push` (or remote equivalent)

## 1. Sale + TSE + Beleg

1. Guest order → pay online (or cash settle on deliver)
2. Verify `orders.tse_signature` is set **after** payment, not on create
3. Verify `fiscal_transactions` row: `tx_type=sale`, `status=signed`
4. Verify `fiscal_artifacts`: `artifact_type=beleg_html` for that transaction
5. Open public beleg via `beleg_token` URL — TSE block shows start/end, serial, QR

## 2. Storno

1. Storno delivered order via dashboard/API
2. Verify `storno_records` + journal `tx_type=storno` with `storno_of_id`
3. Partial storno: amounts scale correctly in journal lines

## 3. Z-Bon

1. Admin → Tagesabschluss → run closing for yesterday
2. Verify `daily_closings.z_nr` allocated monotonically
3. Verify journal `tx_type=z_closing` signed + `fiscal_artifacts` `z_bon_html`
4. Download Z-Bon PDF/HTML — TSE block present

## 4. DSFinV-K

1. Admin → Tagesabschluss → DSFinV-K export (date range with closings)
2. Unzip — check `transactions_tse.csv`: `TSE_ID` = Fiskaly UUID (`tss_id`), not serial
3. Check `cashpointclosing.csv`: `Z_NR` matches `daily_closings.z_nr`

## 5. Kassenmeldepflicht

1. Admin → Kassenmeldung → record Inbetriebnahme
2. Export CSV — row appears with Kassen-ID

## 6. Vorsystem (optional)

1. Connect POS integration on test location
2. Place order — verify `fiscal_handoffs` row after successful push
3. Guest receipt email shows Vorsystem disclaimer (no TSE block)

## 7. Reconcile cron

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://<staging>/api/cron/fiscal-reconcile
```

- [ ] Response: `mismatchCount: 0` (or investigate audit_log)

## 8. Immutability

Try updating `orders.total` on TSE-signed order via SQL — expect trigger error `fiscal_immutable`.

## Rollback criteria

Stop GA if any of:

- Duplicate TSE signatures on same order
- Journal `signed` row without matching Fiskaly tx
- DSFinV-K export empty while closings exist
- Reconcile cron reports signature mismatches

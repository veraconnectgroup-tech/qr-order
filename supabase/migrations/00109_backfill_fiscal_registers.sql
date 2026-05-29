-- FC-6 backfill: one fiscal_registers row per location from org-scoped Fiskaly IDs

INSERT INTO fiscal_registers (
  org_id,
  location_id,
  kassen_id,
  fiskaly_tss_id,
  fiskaly_client_id,
  status
)
SELECT
  l.org_id,
  l.id,
  COALESCE(
    NULLIF(
      trim(
        regexp_replace(l.name, '[^A-Za-z0-9 ''()+,\-./:=?]', '', 'g')
      ),
      ''
    ),
    'loc-' || left(l.id::text, 8)
  ),
  o.fiskaly_tss_id,
  o.fiskaly_client_id,
  'active'
FROM locations l
JOIN organizations o ON o.id = l.org_id
WHERE o.fiskaly_tss_id IS NOT NULL
  AND o.fiskaly_client_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM fiscal_registers fr
    WHERE fr.location_id = l.id
  )
ON CONFLICT (location_id) DO NOTHING;

COMMENT ON TABLE fiscal_registers IS
  'Per-location Fiskaly register (Kasse). Backfilled from org TSS in 00109.';

-- Rollback: manual delete of rows where provisioned_at >= migration apply time if needed.

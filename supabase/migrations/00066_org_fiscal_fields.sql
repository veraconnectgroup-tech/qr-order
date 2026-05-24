-- Org fiscal identity fields for Kassenbeleg (§14 UStG)

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS steuernummer TEXT,
  ADD COLUMN IF NOT EXISTS ust_id_nr TEXT;

COMMENT ON COLUMN organizations.steuernummer IS
  'Steuernummer des Unternehmens (§14 UStG)';
COMMENT ON COLUMN organizations.ust_id_nr IS
  'USt-IdNr des Unternehmens (DE-Format)';

-- FJ-7: Kassenmeldepflicht registration records (§146a Abs. 4 AO)

CREATE TABLE fiscal_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  register_id UUID NOT NULL REFERENCES fiscal_registers(id) ON DELETE RESTRICT,
  kassen_id TEXT NOT NULL,
  tss_serial TEXT,
  inbetriebnahme_at DATE NOT NULL,
  ausserbetriebnahme_at DATE,
  elster_kennung TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'decommissioned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, register_id)
);

CREATE INDEX idx_fiscal_registrations_org ON fiscal_registrations (org_id);
CREATE INDEX idx_fiscal_registrations_location ON fiscal_registrations (location_id);

ALTER TABLE fiscal_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY fiscal_registrations_org_read ON fiscal_registrations
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM staff
      WHERE user_id = auth.uid() AND is_active = true AND deleted_at IS NULL
    )
  );

CREATE POLICY fiscal_registrations_org_write ON fiscal_registrations
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM staff
      WHERE user_id = auth.uid() AND is_active = true AND deleted_at IS NULL
        AND role IN ('owner', 'manager')
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM staff
      WHERE user_id = auth.uid() AND is_active = true AND deleted_at IS NULL
        AND role IN ('owner', 'manager')
    )
  );

COMMENT ON TABLE fiscal_registrations IS
  'Kassenmeldepflicht — ELSTER registration metadata per location/register';

-- Rollback:
-- DROP TABLE IF EXISTS fiscal_registrations;

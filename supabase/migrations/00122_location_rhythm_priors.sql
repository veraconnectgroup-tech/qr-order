-- ADR-042 VRP-P0: venue rhythm priors (learned config artifact)

CREATE TABLE location_rhythm_priors (
  location_id UUID PRIMARY KEY REFERENCES locations(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  priors JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_location_rhythm_priors_org
  ON location_rhythm_priors (org_id, updated_at DESC);

ALTER TABLE location_rhythm_priors ENABLE ROW LEVEL SECURITY;

CREATE POLICY location_rhythm_priors_org_read ON location_rhythm_priors
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM staff
      WHERE user_id = auth.uid() AND is_active = true AND deleted_at IS NULL
    )
  );

COMMENT ON TABLE location_rhythm_priors IS
  'ADR-042 VRP: incremental slot priors learned from commerce.session.completed';

-- Rollback:
-- DROP POLICY IF EXISTS location_rhythm_priors_org_read ON location_rhythm_priors;
-- DROP TABLE IF EXISTS location_rhythm_priors;

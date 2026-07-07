-- ADR-045 S2: Day Close pipeline record — one row per location+business_date,
-- idempotent marker + summary of what the Day Close pass processed/skipped.

CREATE TABLE denis_day_closes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  business_date DATE NOT NULL,
  summary JSONB NOT NULL DEFAULT '{}',
  closed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(location_id, business_date)
);

CREATE INDEX idx_denis_day_closes_location_date
  ON denis_day_closes (location_id, business_date DESC);

ALTER TABLE denis_day_closes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_view_denis_day_closes" ON denis_day_closes
  FOR SELECT USING (location_id = ANY(get_user_location_ids()));

CREATE POLICY "service_role_denis_day_closes" ON denis_day_closes
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE denis_day_closes IS
  'ADR-045 Day Close idempotency + record: one row per location+business_date marks the shift as closed and summarizes what was processed/skipped.';

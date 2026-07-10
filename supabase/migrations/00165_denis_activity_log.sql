-- Denis's own activity log — one row per real action he takes during a
-- staff voice call (checked status, relayed a message, remembered/finished
-- a commitment). Distinct from denis_turn_traces (guest-turn debugging
-- traces): this is short, human-readable, staff-facing history, and it
-- also gets fed back into his own context (see general-token/route.ts) so
-- he stays aware of what he's already done, not just what he's promised.

CREATE TABLE denis_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  station TEXT CHECK (station IN ('kitchen', 'bar')),
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_denis_activity_log_recent
  ON denis_activity_log (location_id, created_at DESC);

ALTER TABLE denis_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_denis_activity_log" ON denis_activity_log
  FOR ALL USING (location_id = ANY(get_user_location_ids()));

CREATE POLICY "service_role_denis_activity_log" ON denis_activity_log
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE denis_activity_log IS
  'Short human-readable record of real actions Denis took during staff voice calls — feeds back into his own context, and gives staff/owner visibility into what he has actually been doing.';

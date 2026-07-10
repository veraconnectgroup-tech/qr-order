-- Denis's own memory of things he promised staff he'd do.
-- Unlike station_questions/relay messages (which resolve within minutes),
-- a commitment can be due today, tomorrow, or later ("javicu sutra") — so
-- this is NOT a shift-scoped table cleared at Day Close. due_date is what
-- makes it relevant: open + due today/overdue is what gets loaded into his
-- context automatically; open + due later stays dormant until its date.

CREATE TABLE denis_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'done', 'cancelled')
  ),
  station TEXT CHECK (station IN ('kitchen', 'bar')),
  promised_to_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_denis_commitments_open_due
  ON denis_commitments (location_id, due_date)
  WHERE status = 'open';

ALTER TABLE denis_commitments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_denis_commitments" ON denis_commitments
  FOR ALL USING (location_id = ANY(get_user_location_ids()));

CREATE POLICY "service_role_denis_commitments" ON denis_commitments
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE denis_commitments IS
  'Things Denis promised staff he''d do, with a due date — not shift-scoped, since a promise can span multiple days.';

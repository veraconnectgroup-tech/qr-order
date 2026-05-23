-- Table transfer audit trail: moving orders between tables.

CREATE TABLE IF NOT EXISTS table_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  from_table_id UUID NOT NULL REFERENCES tables(id) ON DELETE RESTRICT,
  to_table_id UUID NOT NULL REFERENCES tables(id) ON DELETE RESTRICT,
  from_session_id UUID REFERENCES table_sessions(id) ON DELETE SET NULL,
  to_session_id UUID REFERENCES table_sessions(id) ON DELETE SET NULL,
  transferred_by UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  transfer_type TEXT NOT NULL CHECK (transfer_type IN ('full', 'partial')),
  order_ids UUID[] NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_table_transfers_location_created
  ON table_transfers (location_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_table_transfers_from_table
  ON table_transfers (from_table_id);

CREATE INDEX IF NOT EXISTS idx_table_transfers_to_table
  ON table_transfers (to_table_id);

ALTER TABLE table_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_view_table_transfers" ON table_transfers
  FOR SELECT USING (location_id = ANY(get_user_location_ids()));

CREATE POLICY "staff_insert_table_transfers" ON table_transfers
  FOR INSERT WITH CHECK (location_id = ANY(get_user_location_ids()));

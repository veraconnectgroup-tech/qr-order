-- Device-level order blocks after repeated access rejections

CREATE TABLE IF NOT EXISTS table_order_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  blocked_until TIMESTAMPTZ NOT NULL,
  strike_count INT NOT NULL,
  lifted_at TIMESTAMPTZ,
  lifted_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_blocks_active
  ON table_order_blocks (table_id, device_fingerprint, blocked_until DESC)
  WHERE lifted_at IS NULL;

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS rejection_ban_threshold INT NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS rejection_ban_minutes INT NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS rejection_strike_window_minutes INT NOT NULL DEFAULT 30;

ALTER TABLE table_order_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY staff_read_order_blocks ON table_order_blocks
  FOR SELECT USING (location_id = ANY(get_user_location_ids()));

CREATE POLICY service_role_order_blocks ON table_order_blocks
  FOR ALL USING (false);

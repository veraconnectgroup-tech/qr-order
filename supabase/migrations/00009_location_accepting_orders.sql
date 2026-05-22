-- Pause guest ordering without hiding the staff dashboard.
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS accepting_orders BOOLEAN NOT NULL DEFAULT true;

-- Preserve pause state from legacy is_active misuse, then keep locations active for staff.
UPDATE locations
SET accepting_orders = is_active
WHERE accepting_orders IS DISTINCT FROM is_active;

UPDATE locations SET is_active = true WHERE is_active = false;

DROP POLICY IF EXISTS "public_read_locations" ON locations;
CREATE POLICY "public_read_locations" ON locations
  FOR SELECT USING (true);

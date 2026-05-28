ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS require_first_table_approval BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN locations.require_first_table_approval IS
  'When true, first guest order at an empty table waits for staff approval (pending_approval). When false, session opens automatically on first order.';

-- N3 — Denis event mode config (staff-set, JSON document per location)
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS denis_event_config JSONB;

COMMENT ON COLUMN locations.denis_event_config IS
  'Active private event profile when denis_operating_mode = event';

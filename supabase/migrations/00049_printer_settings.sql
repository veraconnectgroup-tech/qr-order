-- ESC/POS printer configuration per location + category routing target.

CREATE TABLE IF NOT EXISTS printer_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('usb', 'lan')),
  ip_address TEXT,
  port INT NOT NULL DEFAULT 9100,
  usb_vendor TEXT,
  usb_product TEXT,
  paper_width INT NOT NULL DEFAULT 80 CHECK (paper_width IN (58, 80)),
  is_default BOOLEAN NOT NULL DEFAULT false,
  auto_print BOOLEAN NOT NULL DEFAULT true,
  print_for TEXT[] NOT NULL DEFAULT '{kitchen}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (print_for <@ ARRAY['kitchen', 'receipt', 'bar']::TEXT[]),
  CHECK (
    (type = 'usb')
    OR (type = 'lan' AND ip_address IS NOT NULL AND port > 0 AND port <= 65535)
  )
);

CREATE INDEX IF NOT EXISTS idx_printer_configs_location
  ON printer_configs (location_id);

ALTER TABLE printer_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_select_printer_configs" ON printer_configs
  FOR SELECT
  USING (location_id = ANY(get_user_location_ids()));

CREATE POLICY "admin_insert_printer_configs" ON printer_configs
  FOR INSERT
  WITH CHECK (
    location_id = ANY(get_user_location_ids())
    AND EXISTS (
      SELECT 1
      FROM staff s
      JOIN locations l ON l.id = printer_configs.location_id
      WHERE s.user_id = auth.uid()
        AND s.is_active = true
        AND s.deleted_at IS NULL
        AND s.org_id = l.org_id
        AND s.role IN ('owner', 'manager')
        AND (s.location_id IS NULL OR s.location_id = printer_configs.location_id)
    )
  );

CREATE POLICY "admin_update_printer_configs" ON printer_configs
  FOR UPDATE
  USING (
    location_id = ANY(get_user_location_ids())
    AND EXISTS (
      SELECT 1
      FROM staff s
      JOIN locations l ON l.id = printer_configs.location_id
      WHERE s.user_id = auth.uid()
        AND s.is_active = true
        AND s.deleted_at IS NULL
        AND s.org_id = l.org_id
        AND s.role IN ('owner', 'manager')
        AND (s.location_id IS NULL OR s.location_id = printer_configs.location_id)
    )
  )
  WITH CHECK (
    location_id = ANY(get_user_location_ids())
    AND EXISTS (
      SELECT 1
      FROM staff s
      JOIN locations l ON l.id = printer_configs.location_id
      WHERE s.user_id = auth.uid()
        AND s.is_active = true
        AND s.deleted_at IS NULL
        AND s.org_id = l.org_id
        AND s.role IN ('owner', 'manager')
        AND (s.location_id IS NULL OR s.location_id = printer_configs.location_id)
    )
  );

CREATE POLICY "admin_delete_printer_configs" ON printer_configs
  FOR DELETE
  USING (
    location_id = ANY(get_user_location_ids())
    AND EXISTS (
      SELECT 1
      FROM staff s
      JOIN locations l ON l.id = printer_configs.location_id
      WHERE s.user_id = auth.uid()
        AND s.is_active = true
        AND s.deleted_at IS NULL
        AND s.org_id = l.org_id
        AND s.role IN ('owner', 'manager')
        AND (s.location_id IS NULL OR s.location_id = printer_configs.location_id)
    )
  );

CREATE TRIGGER trg_printer_configs_updated_at
  BEFORE UPDATE ON printer_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS printer_target TEXT NOT NULL DEFAULT 'kitchen';

ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_printer_target_check;

ALTER TABLE categories
  ADD CONSTRAINT categories_printer_target_check
  CHECK (printer_target IN ('kitchen', 'bar', 'receipt'));

-- M13: Denis venue ops beliefs (rush, KDS stress, staff table hints)

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS denis_operating_mode TEXT NOT NULL DEFAULT 'normal'
    CHECK (denis_operating_mode IN ('normal', 'rush', 'kitchen_closed', 'event')),
  ADD COLUMN IF NOT EXISTS denis_kds_stress TEXT NOT NULL DEFAULT 'normal'
    CHECK (denis_kds_stress IN ('normal', 'high'));

CREATE TABLE IF NOT EXISTS denis_staff_table_hints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (length(trim(text)) >= 1),
  visibility TEXT NOT NULL DEFAULT 'denis_only'
    CHECK (visibility IN ('denis_only', 'guest_safe')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_denis_staff_hints_active
  ON denis_staff_table_hints (table_id, expires_at DESC)
  WHERE revoked_at IS NULL;

ALTER TABLE denis_staff_table_hints ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_denis_staff_hints ON denis_staff_table_hints
  FOR ALL
  USING (auth.role() = 'service_role');

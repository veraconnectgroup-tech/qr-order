-- ADR-024 S3: per-staff permission overrides (template ∪ grants − revokes)

CREATE TABLE IF NOT EXISTS staff_permission_overrides (
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  granted BOOLEAN NOT NULL,
  granted_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_id, permission)
);

CREATE INDEX IF NOT EXISTS idx_staff_permission_overrides_staff
  ON staff_permission_overrides (staff_id);

-- Pending invite overrides applied on accept (ADR-024 S3 invite wire)
ALTER TABLE staff_invites
  ADD COLUMN IF NOT EXISTS permission_overrides JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE staff_permission_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_own_permission_overrides" ON staff_permission_overrides
  FOR SELECT USING (
    staff_id IN (
      SELECT id FROM staff
      WHERE user_id = auth.uid()
        AND is_active = true
        AND deleted_at IS NULL
    )
  );

CREATE POLICY "owner_manager_manage_org_permission_overrides" ON staff_permission_overrides
  FOR ALL USING (
    staff_id IN (
      SELECT s.id
      FROM staff s
      JOIN staff actor ON actor.user_id = auth.uid()
        AND actor.is_active = true
        AND actor.deleted_at IS NULL
        AND actor.org_id = s.org_id
        AND actor.role IN ('owner', 'manager')
    )
  )
  WITH CHECK (
    staff_id IN (
      SELECT s.id
      FROM staff s
      JOIN staff actor ON actor.user_id = auth.uid()
        AND actor.is_active = true
        AND actor.deleted_at IS NULL
        AND actor.org_id = s.org_id
        AND actor.role IN ('owner', 'manager')
    )
  );

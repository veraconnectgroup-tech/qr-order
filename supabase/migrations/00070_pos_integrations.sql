-- POS system connections per location (Track C).

CREATE TABLE pos_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN (
    'deliverect', 'orderbird', 'lightspeed', 'ready2order', 'custom'
  )),
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN (
    'disconnected', 'connected', 'error'
  )),
  config JSONB NOT NULL DEFAULT '{}',
  external_location_id TEXT,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, provider)
);

CREATE INDEX idx_pos_integrations_location
  ON pos_integrations (location_id)
  WHERE status = 'connected';

ALTER TABLE pos_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_select_pos_integrations" ON pos_integrations
  FOR SELECT
  USING (location_id = ANY(get_user_location_ids()));

CREATE POLICY "admin_insert_pos_integrations" ON pos_integrations
  FOR INSERT
  WITH CHECK (
    location_id = ANY(get_user_location_ids())
    AND EXISTS (
      SELECT 1
      FROM staff s
      JOIN locations l ON l.id = pos_integrations.location_id
      WHERE s.user_id = auth.uid()
        AND s.is_active = true
        AND s.deleted_at IS NULL
        AND s.org_id = l.org_id
        AND s.role IN ('owner', 'manager')
        AND (s.location_id IS NULL OR s.location_id = pos_integrations.location_id)
    )
  );

CREATE POLICY "admin_update_pos_integrations" ON pos_integrations
  FOR UPDATE
  USING (
    location_id = ANY(get_user_location_ids())
    AND EXISTS (
      SELECT 1
      FROM staff s
      JOIN locations l ON l.id = pos_integrations.location_id
      WHERE s.user_id = auth.uid()
        AND s.is_active = true
        AND s.deleted_at IS NULL
        AND s.org_id = l.org_id
        AND s.role IN ('owner', 'manager')
        AND (s.location_id IS NULL OR s.location_id = pos_integrations.location_id)
    )
  )
  WITH CHECK (
    location_id = ANY(get_user_location_ids())
    AND EXISTS (
      SELECT 1
      FROM staff s
      JOIN locations l ON l.id = pos_integrations.location_id
      WHERE s.user_id = auth.uid()
        AND s.is_active = true
        AND s.deleted_at IS NULL
        AND s.org_id = l.org_id
        AND s.role IN ('owner', 'manager')
        AND (s.location_id IS NULL OR s.location_id = pos_integrations.location_id)
    )
  );

CREATE POLICY "admin_delete_pos_integrations" ON pos_integrations
  FOR DELETE
  USING (
    location_id = ANY(get_user_location_ids())
    AND EXISTS (
      SELECT 1
      FROM staff s
      JOIN locations l ON l.id = pos_integrations.location_id
      WHERE s.user_id = auth.uid()
        AND s.is_active = true
        AND s.deleted_at IS NULL
        AND s.org_id = l.org_id
        AND s.role IN ('owner', 'manager')
        AND (s.location_id IS NULL OR s.location_id = pos_integrations.location_id)
    )
  );

CREATE TRIGGER trg_pos_integrations_updated_at
  BEFORE UPDATE ON pos_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE pos_integrations IS
  'POS system connections per location (Track C).';

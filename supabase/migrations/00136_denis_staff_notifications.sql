-- Layer 11 AK4: in-app Denis staff notifications (push + bell)

CREATE TABLE IF NOT EXISTS denis_staff_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  message TEXT NOT NULL,
  table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
  table_name TEXT,
  action_url TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_denis_staff_notifications_location_unread
  ON denis_staff_notifications (location_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_denis_staff_notifications_location_created
  ON denis_staff_notifications (location_id, created_at DESC);

ALTER TABLE denis_staff_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY staff_read_denis_staff_notifications ON denis_staff_notifications
  FOR SELECT
  USING (location_id = ANY(get_user_location_ids()));

CREATE POLICY staff_update_denis_staff_notifications ON denis_staff_notifications
  FOR UPDATE
  USING (location_id = ANY(get_user_location_ids()))
  WITH CHECK (location_id = ANY(get_user_location_ids()));

COMMENT ON TABLE denis_staff_notifications IS
  'Layer 11: Denis staff alerts (allergy, high value order, escalation) — in-app bell + push';

-- Rollback:
-- DROP TABLE IF EXISTS denis_staff_notifications;

-- Denis ROI event log — granular attribution for owner dashboard & churn prevention

CREATE TABLE IF NOT EXISTS denis_roi_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'upsell_accepted',
      'win_back_sent',
      'win_back_returned',
      'conversation',
      'allergy_warning',
      'allergy_block',
      'complaint_handled',
      'complaint_resolved'
    )
  ),
  amount_cents INT NOT NULL DEFAULT 0,
  quantity INT NOT NULL DEFAULT 1,
  label TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_denis_roi_events_location_created
  ON denis_roi_events (location_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_denis_roi_events_org_created
  ON denis_roi_events (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_denis_roi_events_type
  ON denis_roi_events (location_id, event_type, created_at DESC);

ALTER TABLE denis_roi_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_denis_roi_events" ON denis_roi_events
  FOR SELECT
  USING (location_id = ANY(get_user_location_ids()));

CREATE POLICY "service_role_manage_denis_roi_events" ON denis_roi_events
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE denis_roi_events IS
  'Denis ROI attribution — upsell, win-back, time saved, allergy safety';

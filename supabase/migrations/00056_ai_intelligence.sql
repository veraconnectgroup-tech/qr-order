-- AI intelligence: daily insights + enriched session telemetry

CREATE TABLE IF NOT EXISTS ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (
    type IN ('menu_gap', 'demand_signal', 'conversion', 'alert', 'feedback_summary')
  ),
  severity TEXT NOT NULL DEFAULT 'info' CHECK (
    severity IN ('info', 'warning', 'critical')
  ),
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  insight_date DATE NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_org_date
  ON ai_insights (org_id, insight_date DESC);

CREATE INDEX IF NOT EXISTS idx_ai_insights_location_date
  ON ai_insights (location_id, insight_date DESC)
  WHERE location_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_insights_unread
  ON ai_insights (org_id, is_read, insight_date DESC)
  WHERE is_read = false;

ALTER TABLE ai_sessions
  ADD COLUMN IF NOT EXISTS scroll_context JSONB,
  ADD COLUMN IF NOT EXISTS nudges_shown TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS guest_rating SMALLINT
    CHECK (guest_rating IS NULL OR guest_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS guest_feedback TEXT;

ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_ai_insights" ON ai_insights
  FOR SELECT
  USING (org_id = ANY(get_user_org_ids()));

CREATE POLICY "staff_update_ai_insights" ON ai_insights
  FOR UPDATE
  USING (org_id = ANY(get_user_org_ids()))
  WITH CHECK (org_id = ANY(get_user_org_ids()));

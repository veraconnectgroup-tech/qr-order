-- ADR-014 CE-3 / GMM-13: daily anticipation rollup for chain analytics

CREATE TABLE experience_analytics_daily (
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,

  nudge_impressions INTEGER NOT NULL DEFAULT 0,
  offer_conversions INTEGER NOT NULL DEFAULT 0,
  conversion_lag_seconds INTEGER NOT NULL DEFAULT 0,

  by_nudge_kind JSONB NOT NULL DEFAULT '{}',
  by_offer_resolution JSONB NOT NULL DEFAULT '{}',

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (location_id, metric_date)
);

CREATE INDEX idx_experience_analytics_org_date
  ON experience_analytics_daily (org_id, metric_date DESC);

ALTER TABLE experience_analytics_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY experience_analytics_org_read ON experience_analytics_daily
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM staff
      WHERE user_id = auth.uid() AND is_active = true AND deleted_at IS NULL
    )
  );

COMMENT ON TABLE experience_analytics_daily IS
  'ADR-014: daily Denis anticipation rollup (nudge impressions + offer conversions)';

-- Rollback:
-- DROP POLICY IF EXISTS experience_analytics_org_read ON experience_analytics_daily;
-- DROP TABLE IF EXISTS experience_analytics_daily;

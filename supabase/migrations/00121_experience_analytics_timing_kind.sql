-- ADR-040 P5: timingKind dimension on daily anticipation rollup

ALTER TABLE experience_analytics_daily
  ADD COLUMN IF NOT EXISTS by_timing_kind JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN experience_analytics_daily.by_timing_kind IS
  'ADR-040: daily nudge impressions keyed by offer timing kind (browse_pause, return_view, …)';

-- Rollback:
-- ALTER TABLE experience_analytics_daily DROP COLUMN IF EXISTS by_timing_kind;

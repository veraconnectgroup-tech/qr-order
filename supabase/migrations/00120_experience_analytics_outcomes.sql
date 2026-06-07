-- ADR-039 L2: nudge outcome breakdown on daily anticipation rollup

ALTER TABLE experience_analytics_daily
  ADD COLUMN IF NOT EXISTS nudge_declined INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nudge_ignored INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nudge_expired INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS by_outcome JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN experience_analytics_daily.by_outcome IS
  'ADR-039: daily nudge outcome counts keyed by outcome kind';

-- Rollback:
-- ALTER TABLE experience_analytics_daily
--   DROP COLUMN IF EXISTS nudge_declined,
--   DROP COLUMN IF EXISTS nudge_ignored,
--   DROP COLUMN IF EXISTS nudge_expired,
--   DROP COLUMN IF EXISTS by_outcome;

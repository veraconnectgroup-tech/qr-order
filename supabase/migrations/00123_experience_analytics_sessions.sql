-- ADR-042 VRP-P3: session close metrics on daily experience rollup

ALTER TABLE experience_analytics_daily
  ADD COLUMN IF NOT EXISTS sessions_closed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS session_revenue_total NUMERIC(12, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN experience_analytics_daily.sessions_closed IS
  'ADR-042 VRP: closed table sessions counted from commerce.session.completed';

COMMENT ON COLUMN experience_analytics_daily.session_revenue_total IS
  'ADR-042 VRP: paid session revenue rollup from commerce.session.completed';

-- Rollback:
-- ALTER TABLE experience_analytics_daily
--   DROP COLUMN IF EXISTS sessions_closed,
--   DROP COLUMN IF EXISTS session_revenue_total;

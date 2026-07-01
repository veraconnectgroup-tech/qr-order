-- Layer 11 AI1: Denis ROI metrics on daily experience rollup

ALTER TABLE experience_analytics_daily
  ADD COLUMN IF NOT EXISTS converted_sessions INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS upsell_revenue_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_cost_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS t0_turns INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS llm_turns INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS returning_guest_sessions INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS order_time_seconds_total INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS by_nudge_revenue JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN experience_analytics_daily.converted_sessions IS
  'Layer 11: sessions with at least one paid order (Denis-attributed)';

COMMENT ON COLUMN experience_analytics_daily.upsell_revenue_total IS
  'Layer 11: revenue from accepted upsell/pairing nudges';

COMMENT ON COLUMN experience_analytics_daily.ai_cost_cents IS
  'Layer 11: OpenAI / LLM cost for Denis turns on this day';

COMMENT ON COLUMN experience_analytics_daily.t0_turns IS
  'Layer 11: T0 reflex turns (no LLM cost)';

COMMENT ON COLUMN experience_analytics_daily.llm_turns IS
  'Layer 11: LLM-backed Denis turns';

COMMENT ON COLUMN experience_analytics_daily.returning_guest_sessions IS
  'Layer 11: sessions from guests seen within prior 30 days';

COMMENT ON COLUMN experience_analytics_daily.order_time_seconds_total IS
  'Layer 11: sum of seconds from session open to first order';

COMMENT ON COLUMN experience_analytics_daily.by_nudge_revenue IS
  'Layer 11: nudge category → { accepted, revenue } for top performers';

-- Rollback:
-- ALTER TABLE experience_analytics_daily
--   DROP COLUMN IF EXISTS converted_sessions,
--   DROP COLUMN IF EXISTS upsell_revenue_total,
--   DROP COLUMN IF EXISTS ai_cost_cents,
--   DROP COLUMN IF EXISTS t0_turns,
--   DROP COLUMN IF EXISTS llm_turns,
--   DROP COLUMN IF EXISTS returning_guest_sessions,
--   DROP COLUMN IF EXISTS order_time_seconds_total,
--   DROP COLUMN IF EXISTS by_nudge_revenue;

-- Layer 11 AI2: daily Denis experience score on experience rollup

ALTER TABLE experience_analytics_daily
  ADD COLUMN IF NOT EXISTS experience_score NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS experience_score_components JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS abandoned_sessions INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cart_corrections INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repeated_questions INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_turns INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN experience_analytics_daily.experience_score IS
  'Layer 11: automated guest experience score 0–100';

COMMENT ON COLUMN experience_analytics_daily.experience_score_components IS
  'Layer 11: score component breakdown (conversion, efficiency, accuracy, satisfaction)';

-- Rollback:
-- ALTER TABLE experience_analytics_daily
--   DROP COLUMN IF EXISTS experience_score,
--   DROP COLUMN IF EXISTS experience_score_components,
--   DROP COLUMN IF EXISTS abandoned_sessions,
--   DROP COLUMN IF EXISTS cart_corrections,
--   DROP COLUMN IF EXISTS repeated_questions,
--   DROP COLUMN IF EXISTS total_turns;

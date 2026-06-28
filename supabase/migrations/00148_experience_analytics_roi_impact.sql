-- Layer 11 AI2: Denis ROI impact counters (savings + satisfaction signals)

ALTER TABLE experience_analytics_daily
  ADD COLUMN IF NOT EXISTS by_roi_impact JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN experience_analytics_daily.by_roi_impact IS
  'Layer 11: ROI dashboard counters — waiter_calls_saved, kitchen_delay_prevented, allergy_catches, review_clicks, tokens_total';

-- Rollback:
-- ALTER TABLE experience_analytics_daily DROP COLUMN IF EXISTS by_roi_impact;

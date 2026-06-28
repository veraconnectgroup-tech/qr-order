-- G1: Learned basket pairs — co-occurrence from delivered orders per table session

ALTER TABLE location_rhythm_priors
  ADD COLUMN IF NOT EXISTS learned_basket_pairs JSONB NOT NULL DEFAULT '{"version":1,"pairs":[]}'::jsonb;

COMMENT ON COLUMN location_rhythm_priors.learned_basket_pairs IS
  'G1: venue-specific product co-occurrence pairs (weekly rollup, min 10 sessions)';

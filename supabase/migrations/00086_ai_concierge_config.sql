-- M1: Denis ConciergeConfig storage (org → location merge in app)

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS ai_concierge_config JSONB;

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS ai_concierge_config JSONB;

COMMENT ON COLUMN organizations.ai_concierge_config IS
  'Partial ConciergeConfig overrides for all locations in org (Denis M1)';

COMMENT ON COLUMN locations.ai_concierge_config IS
  'Partial ConciergeConfig overrides for this location (Denis M1)';

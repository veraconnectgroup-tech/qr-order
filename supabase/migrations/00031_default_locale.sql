ALTER TABLE locations ADD COLUMN IF NOT EXISTS default_locale TEXT NOT NULL DEFAULT 'de';

ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_default_locale_check;
ALTER TABLE locations ADD CONSTRAINT locations_default_locale_check
  CHECK (default_locale IN ('de', 'en', 'sr', 'tr', 'hr'));

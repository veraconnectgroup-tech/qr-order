-- Restaurant-configurable guest UI languages per location

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS available_locales TEXT[] NOT NULL DEFAULT ARRAY['de']::TEXT[];

ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_default_locale_check;

ALTER TABLE locations
  ADD CONSTRAINT locations_default_locale_check
  CHECK (
    default_locale IN ('de', 'en', 'sr', 'tr', 'hr', 'ar', 'fr', 'es', 'it', 'ru')
  );

-- Backfill: expose current default as the only available locale where unset
UPDATE locations
SET available_locales = ARRAY[default_locale]::TEXT[]
WHERE available_locales IS NULL
   OR cardinality(available_locales) = 0;

-- Demo location: common EU languages
UPDATE locations
SET
  available_locales = ARRAY['de', 'en', 'sr', 'hr', 'tr']::TEXT[],
  default_locale = 'de'
WHERE id = 'b0000000-0000-4000-8000-000000000001'
  AND cardinality(available_locales) <= 1;

-- Primary menu language per location (guest chooses this OR English)
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS menu_locale TEXT NOT NULL DEFAULT 'de';

ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_menu_locale_check;

ALTER TABLE locations
  ADD CONSTRAINT locations_menu_locale_check
  CHECK (menu_locale IN ('de', 'sr', 'tr', 'hr', 'fr', 'es', 'it', 'ru', 'ar'));

UPDATE locations
SET menu_locale = CASE
  WHEN default_locale IS NOT NULL AND default_locale <> 'en' THEN default_locale
  ELSE 'de'
END
WHERE menu_locale IS NULL OR menu_locale = 'de';

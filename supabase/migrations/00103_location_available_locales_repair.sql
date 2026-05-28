-- Repair drift: cloud-setup baselines may skip 00037 while app types expect this column.

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS available_locales TEXT[] NOT NULL DEFAULT ARRAY['de']::TEXT[];

UPDATE locations
SET available_locales = ARRAY[COALESCE(default_locale, menu_locale, 'de'), 'en']::TEXT[]
WHERE available_locales IS NULL
   OR cardinality(available_locales) = 0;

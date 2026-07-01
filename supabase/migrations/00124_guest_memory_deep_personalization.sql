-- F1: Deep guest memory — modifier prefs, spend/session averages, meal pattern

ALTER TABLE denis_guest_memory
  ADD COLUMN IF NOT EXISTS modifier_preferences TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS avg_spend_cents INT,
  ADD COLUMN IF NOT EXISTS avg_session_minutes NUMERIC(8, 2),
  ADD COLUMN IF NOT EXISTS preferred_meal_pattern TEXT;

COMMENT ON COLUMN denis_guest_memory.modifier_preferences IS
  'Recurring modifier labels from delivered orders (consented guests only)';
COMMENT ON COLUMN denis_guest_memory.avg_spend_cents IS
  'Running average session spend in minor currency units';
COMMENT ON COLUMN denis_guest_memory.avg_session_minutes IS
  'Running average table session duration in minutes';
COMMENT ON COLUMN denis_guest_memory.preferred_meal_pattern IS
  'Detected ordering pattern: drinks_only, main_only, main_drinks, main_dessert, starter_main_dessert';

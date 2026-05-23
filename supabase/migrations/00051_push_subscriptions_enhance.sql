-- Push subscriptions: staff linkage + normalized key column names.

ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'push_subscriptions'
      AND column_name = 'keys_p256dh'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'push_subscriptions'
      AND column_name = 'p256dh'
  ) THEN
    ALTER TABLE push_subscriptions RENAME COLUMN keys_p256dh TO p256dh;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'push_subscriptions'
      AND column_name = 'keys_auth'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'push_subscriptions'
      AND column_name = 'auth'
  ) THEN
    ALTER TABLE push_subscriptions RENAME COLUMN keys_auth TO auth;
  END IF;
END $$;

UPDATE push_subscriptions ps
SET staff_id = s.id
FROM staff s
WHERE ps.staff_id IS NULL
  AND ps.user_id = s.user_id
  AND s.is_active = true
  AND s.deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_staff
  ON push_subscriptions (staff_id);

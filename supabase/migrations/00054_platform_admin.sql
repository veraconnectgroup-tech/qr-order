-- Platform superadmin + per-org feature flags.

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN DEFAULT false;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS feature_flags JSONB DEFAULT '{}'::jsonb;

UPDATE staff
SET is_platform_admin = true
WHERE id = (
  SELECT id
  FROM staff
  WHERE role = 'owner'
    AND deleted_at IS NULL
  ORDER BY created_at ASC
  LIMIT 1
);

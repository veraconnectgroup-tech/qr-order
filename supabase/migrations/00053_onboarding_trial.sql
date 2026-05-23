-- Self-service onboarding + trial tracking on organizations.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

UPDATE organizations SET onboarding_completed = true WHERE onboarding_completed IS NOT TRUE;

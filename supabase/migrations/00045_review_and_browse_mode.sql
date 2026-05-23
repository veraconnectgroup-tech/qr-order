ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS google_review_url TEXT;

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS ordering_enabled BOOLEAN
  NOT NULL DEFAULT true;

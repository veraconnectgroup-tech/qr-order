-- Denis proactive / order context: prep estimate confidence on orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS prep_estimate_confidence text
  CHECK (
    prep_estimate_confidence IS NULL
    OR prep_estimate_confidence IN ('none', 'low', 'medium', 'high')
  );

COMMENT ON COLUMN orders.prep_estimate_confidence IS
  'Confidence for estimated_prep_minutes (Denis proactive / status).';

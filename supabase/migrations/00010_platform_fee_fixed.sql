-- Fixed platform fee per card payment (default €0.40, €0.20 on orders under €10).
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS platform_fee_fixed DECIMAL(10,2) NOT NULL DEFAULT 0.40;

ALTER TABLE organizations
  ALTER COLUMN platform_fee_percent SET DEFAULT 0.00;

UPDATE organizations
SET platform_fee_fixed = 0.40, platform_fee_percent = 0;

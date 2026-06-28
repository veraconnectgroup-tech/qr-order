-- Referral system extensions (guest brings guest)

ALTER TABLE guest_loyalty_profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT,
  ADD COLUMN IF NOT EXISTS referral_display_name TEXT,
  ADD COLUMN IF NOT EXISTS social_proof_opt_in BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE loyalty_referrals
  ADD COLUMN IF NOT EXISTS referral_code TEXT,
  ADD COLUMN IF NOT EXISTS referrer_device_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS referred_device_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS first_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referred_welcome_applied BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS referrer_bonus_points INT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_guest_loyalty_referral_code
  ON guest_loyalty_profiles (location_id, referral_code)
  WHERE referral_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_referrals_referred_device
  ON loyalty_referrals (location_id, referred_device_fingerprint)
  WHERE referred_device_fingerprint IS NOT NULL;

COMMENT ON COLUMN guest_loyalty_profiles.referral_code IS
  'Short shareable code (VERA-XXXX) for QR referral links.';
COMMENT ON COLUMN guest_loyalty_profiles.social_proof_opt_in IS
  'Guest opted in to show first name on referral social proof.';
COMMENT ON COLUMN loyalty_referrals.referred_welcome_applied IS
  '10% welcome discount consumed on referred guest first order.';

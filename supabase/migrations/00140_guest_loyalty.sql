-- Guest Level / Loyalty / Gamification (Denis commerce)

CREATE TABLE IF NOT EXISTS guest_loyalty_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  guest_token TEXT NOT NULL,
  level SMALLINT NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 4),
  points INT NOT NULL DEFAULT 0 CHECK (points >= 0),
  total_spent NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_spent >= 0),
  visit_count INT NOT NULL DEFAULT 0 CHECK (visit_count >= 0),
  streak_tier SMALLINT NOT NULL DEFAULT 0 CHECK (streak_tier IN (0, 2, 4)),
  streak_count INT NOT NULL DEFAULT 0 CHECK (streak_count >= 0),
  last_visit_at TIMESTAMPTZ,
  previous_level SMALLINT CHECK (previous_level IS NULL OR previous_level BETWEEN 1 AND 4),
  level_up_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, guest_token)
);

CREATE INDEX IF NOT EXISTS idx_guest_loyalty_profiles_location
  ON guest_loyalty_profiles (location_id, level);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES guest_loyalty_profiles(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  guest_token TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earn', 'redeem')),
  points INT NOT NULL,
  reason TEXT NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_guest
  ON loyalty_transactions (location_id, guest_token, created_at DESC);

CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  level SMALLINT NOT NULL CHECK (level BETWEEN 1 AND 4),
  reward_type TEXT NOT NULL,
  reward_value TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'unlimited',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loyalty_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  referrer_guest_token TEXT NOT NULL,
  referred_guest_token TEXT NOT NULL,
  bonus_applied BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, referred_guest_token)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_referrals_referrer
  ON loyalty_referrals (location_id, referrer_guest_token);

-- Seed default rewards (platform-wide, location_id NULL)
INSERT INTO loyalty_rewards (location_id, level, reward_type, reward_value, frequency)
VALUES
  (NULL, 2, 'waitlist_priority', '+1', 'unlimited'),
  (NULL, 3, 'waitlist_priority', '+3', 'unlimited'),
  (NULL, 3, 'free_dessert', 'monthly', 'monthly'),
  (NULL, 3, 'secret_menu', 'access', 'unlimited'),
  (NULL, 4, 'waitlist_priority', 'max', 'unlimited'),
  (NULL, 4, 'monthly_surprise', 'enabled', 'monthly'),
  (NULL, 4, 'exclusive_events', 'invite', 'unlimited');

ALTER TABLE guest_loyalty_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY guest_loyalty_profiles_staff ON guest_loyalty_profiles
  FOR ALL
  USING (location_id = ANY(get_user_location_ids()))
  WITH CHECK (location_id = ANY(get_user_location_ids()));

CREATE POLICY loyalty_transactions_staff ON loyalty_transactions
  FOR SELECT USING (location_id = ANY(get_user_location_ids()));

CREATE POLICY loyalty_rewards_staff ON loyalty_rewards
  FOR SELECT USING (
    location_id IS NULL OR location_id = ANY(get_user_location_ids())
  );

CREATE POLICY loyalty_referrals_staff ON loyalty_referrals
  FOR SELECT USING (location_id = ANY(get_user_location_ids()));

COMMENT ON TABLE guest_loyalty_profiles IS
  'Guest level, points, streak — Denis loyalty gamification.';
COMMENT ON TABLE loyalty_transactions IS
  'Earn/redeem ledger for loyalty points.';
COMMENT ON TABLE loyalty_rewards IS
  'Per-level reward catalog (NULL location = platform default).';
COMMENT ON TABLE loyalty_referrals IS
  'QR share referral tracking — bonus on first referred visit.';

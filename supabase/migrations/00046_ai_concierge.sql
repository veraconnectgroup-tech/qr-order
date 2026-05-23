-- AI Concierge: credits, sessions, packages, product/location flags

-- ===== Per-organization credit balance =====
CREATE TABLE IF NOT EXISTS ai_credits (
  org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_purchased INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_purchased >= 0),
  lifetime_used INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_used >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_credits_updated
  ON ai_credits (updated_at DESC);

-- ===== Guest AI concierge sessions =====
CREATE TABLE IF NOT EXISTS ai_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  guest_preferences JSONB NOT NULL DEFAULT '{"allergies":[],"mood":""}'::jsonb,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  tokens_used INTEGER NOT NULL DEFAULT 0 CHECK (tokens_used >= 0),
  credits_used INTEGER NOT NULL DEFAULT 0 CHECK (credits_used >= 0),
  products_recommended TEXT[] NOT NULL DEFAULT '{}',
  products_added TEXT[] NOT NULL DEFAULT '{}',
  conversion_count INTEGER NOT NULL DEFAULT 0 CHECK (conversion_count >= 0),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_sessions_org
  ON ai_sessions (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_sessions_location
  ON ai_sessions (location_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_sessions_status
  ON ai_sessions (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_sessions_session_token
  ON ai_sessions (session_token, status);

-- ===== Purchasable credit packages (platform catalog) =====
CREATE TABLE IF NOT EXISTS ai_credit_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  credits INTEGER NOT NULL CHECK (credits > 0),
  price_cents INTEGER NOT NULL CHECK (price_cents > 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_credit_packages_active
  ON ai_credit_packages (is_active, sort_order);

INSERT INTO ai_credit_packages (id, name, credits, price_cents, currency, sort_order)
VALUES
  (
    'a1000000-0000-4000-8000-000000000001',
    'Starter',
    500,
    1900,
    'EUR',
    1
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    'Pro',
    2000,
    4900,
    'EUR',
    2
  ),
  (
    'a1000000-0000-4000-8000-000000000003',
    'Enterprise',
    10000,
    14900,
    'EUR',
    3
  )
ON CONFLICT (id) DO NOTHING;

-- ===== Product & location flags =====
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS ai_description TEXT;

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS ai_concierge_enabled BOOLEAN NOT NULL DEFAULT false;

-- ===== Atomic credit operations (service role only) =====
CREATE OR REPLACE FUNCTION decrement_ai_credits(p_org_id UUID, p_amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'decrement_ai_credits: amount must be a positive integer';
  END IF;

  UPDATE ai_credits
  SET
    balance = balance - p_amount,
    lifetime_used = lifetime_used + p_amount,
    updated_at = now()
  WHERE org_id = p_org_id
    AND balance >= p_amount
  RETURNING balance INTO v_balance;

  IF FOUND THEN
    RETURN v_balance;
  END IF;

  RETURN -1;
END;
$$;

CREATE OR REPLACE FUNCTION add_ai_credits(p_org_id UUID, p_amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'add_ai_credits: amount must be a positive integer';
  END IF;

  INSERT INTO ai_credits (org_id, balance, lifetime_purchased, lifetime_used)
  VALUES (p_org_id, p_amount, p_amount, 0)
  ON CONFLICT (org_id) DO UPDATE
  SET
    balance = ai_credits.balance + EXCLUDED.balance,
    lifetime_purchased = ai_credits.lifetime_purchased + p_amount,
    updated_at = now()
  RETURNING balance INTO v_balance;

  RETURN v_balance;
END;
$$;

REVOKE ALL ON FUNCTION decrement_ai_credits(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION add_ai_credits(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION decrement_ai_credits(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION add_ai_credits(UUID, INTEGER) TO service_role;

-- ===== RLS =====
ALTER TABLE ai_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_credit_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_ai_credits" ON ai_credits
  FOR SELECT
  USING (org_id = ANY(get_user_org_ids()));

CREATE POLICY "staff_read_ai_sessions" ON ai_sessions
  FOR SELECT
  USING (org_id = ANY(get_user_org_ids()));

CREATE POLICY "public_read_ai_credit_packages" ON ai_credit_packages
  FOR SELECT
  USING (is_active = true);

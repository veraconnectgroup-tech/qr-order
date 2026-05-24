CREATE TABLE plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_cents INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  interval TEXT NOT NULL DEFAULT 'month'
    CHECK (interval IN ('month', 'year')),
  features JSONB NOT NULL DEFAULT '[]',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO plans (id, name, price_cents, features, sort_order) VALUES
  ('starter', 'Starter', 4900,
    '["QR Ordering","Cloud Print","Dashboard"]', 1),
  ('business', 'Business', 9900,
    '["Alles in Starter","TSE + Z-Bon","Beleg","DATEV"]', 2),
  ('enterprise', 'Enterprise', 19900,
    '["Alles in Business","POS Integration","Multi-Location","Priority Support"]', 3);

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS plan_id TEXT
    REFERENCES plans(id) DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT
    DEFAULT 'trialing'
    CHECK (subscription_status IN
      ('trialing','active','past_due',
       'canceled','unpaid'));

CREATE INDEX IF NOT EXISTS idx_orgs_plan
  ON organizations (plan_id);
CREATE INDEX IF NOT EXISTS idx_orgs_sub_status
  ON organizations (subscription_status);

UPDATE organizations
SET
  plan_id = COALESCE(plan_id, 'starter'),
  subscription_status = COALESCE(subscription_status, 'trialing')
WHERE plan_id IS NULL OR subscription_status IS NULL;

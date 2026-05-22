-- ===== Location accepting_orders (migration 00009) =====
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS accepting_orders BOOLEAN NOT NULL DEFAULT true;

UPDATE locations
SET accepting_orders = is_active
WHERE accepting_orders IS DISTINCT FROM is_active;

UPDATE locations SET is_active = true WHERE is_active = false;

DROP POLICY IF EXISTS "public_read_locations" ON locations;
CREATE POLICY "public_read_locations" ON locations
  FOR SELECT USING (true);

-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT / DROP POLICY IF EXISTS.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS receipt_sent_at TIMESTAMPTZ;

-- ===== Security audit (migration 00004) =====
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_by UUID REFERENCES staff(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  amount DECIMAL(10,2),
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read own org audit log" ON audit_log;
CREATE POLICY "Staff read own org audit log" ON audit_log
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM orders WHERE location_id = ANY(get_user_location_ids())
    )
    OR staff_id IN (
      SELECT id FROM staff WHERE org_id = ANY(get_user_org_ids())
    )
  );

DROP POLICY IF EXISTS "Service role manages audit log" ON audit_log;
CREATE POLICY "Service role manages audit log" ON audit_log
  FOR ALL USING (false);

-- ===== Demo product photos (optional — Skyline Lounge seed IDs) =====
UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1536935338788-846bb9981813?w=600&q=80',
  allergens = ARRAY['sulfites']
WHERE id = 'f0000000-0000-4000-8000-000000000001';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=600&q=80',
  allergens = ARRAY['sulfites']
WHERE id = 'f0000000-0000-4000-8000-000000000002';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=600&q=80',
  allergens = ARRAY['sulfites']
WHERE id = 'f0000000-0000-4000-8000-000000000003';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1541544187151-7d73e83e6f9f?w=600&q=80',
  allergens = ARRAY['sulfites']
WHERE id = 'f0000000-0000-4000-8000-000000000004';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1573080496216-bf07096c9673?w=600&q=80',
  allergens = ARRAY['gluten', 'dairy']
WHERE id = 'f0000000-0000-4000-8000-000000000019';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1513458032977-3c3f35676546?w=600&q=80',
  allergens = ARRAY['gluten', 'dairy']
WHERE id = 'f0000000-0000-4000-8000-000000000020';

-- ===== Product image upload bucket (migration 00006) =====
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
CREATE POLICY "Public read product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Staff upload product images" ON storage.objects;
CREATE POLICY "Staff upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1]::uuid = ANY(get_user_org_ids())
);

DROP POLICY IF EXISTS "Staff update product images" ON storage.objects;
CREATE POLICY "Staff update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1]::uuid = ANY(get_user_org_ids())
);

DROP POLICY IF EXISTS "Staff delete product images" ON storage.objects;
CREATE POLICY "Staff delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1]::uuid = ANY(get_user_org_ids())
);

-- ===== Staff invites (migration 00008) =====
CREATE TABLE IF NOT EXISTS staff_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'staff', 'kitchen')),
  invited_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_invites_token ON staff_invites(token);
CREATE INDEX IF NOT EXISTS idx_staff_invites_org ON staff_invites(org_id);

ALTER TABLE staff_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read own org invites" ON staff_invites;
CREATE POLICY "Staff read own org invites" ON staff_invites
  FOR SELECT USING (org_id = ANY(get_user_org_ids()));

DROP POLICY IF EXISTS "Service role manages staff invites" ON staff_invites;
CREATE POLICY "Service role manages staff invites" ON staff_invites
  FOR ALL USING (false);

-- ===== Realtime for live dashboard (migration 00003) =====
ALTER TABLE orders REPLICA IDENTITY FULL;
ALTER TABLE waiter_calls REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'waiter_calls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE waiter_calls;
  END IF;
END $$;

-- ===== Fixed platform fee per order (migration 00010) =====
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS platform_fee_fixed DECIMAL(10,2) NOT NULL DEFAULT 0.40;

ALTER TABLE organizations
  ALTER COLUMN platform_fee_percent SET DEFAULT 0.00;

UPDATE organizations
SET platform_fee_fixed = 0.40, platform_fee_percent = 0;

-- ===== Realtime replica identity (migration 00011) =====
ALTER TABLE orders REPLICA IDENTITY FULL;
ALTER TABLE waiter_calls REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'waiter_calls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE waiter_calls;
  END IF;
END $$;

-- ===== Payment methods (migration 00012) =====
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS payment_online_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS payment_at_bar_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS payment_card_at_table_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'online';

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('online', 'at_bar', 'card_at_table'));

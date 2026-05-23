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

-- ===== Demo product photos (00005 + 00016 — Skyline Lounge seed IDs) =====
-- See src/lib/product-stock-images.ts for the canonical list.

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1758218058958-78f40a716c20?w=600&q=80',
  allergens = ARRAY['sulfites']
WHERE id = 'f0000000-0000-4000-8000-000000000001';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=600&q=80',
  allergens = ARRAY['sulfites']
WHERE id = 'f0000000-0000-4000-8000-000000000002';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=600&q=80',
  allergens = ARRAY['sulfites']
WHERE id = 'f0000000-0000-4000-8000-000000000003';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&q=80',
  allergens = ARRAY['sulfites']
WHERE id = 'f0000000-0000-4000-8000-000000000004';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=600&q=80',
  allergens = ARRAY['sulfites']
WHERE id = 'f0000000-0000-4000-8000-000000000005';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=600&q=80',
  allergens = ARRAY['sulfites']
WHERE id = 'f0000000-0000-4000-8000-000000000006';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&q=80',
  allergens = ARRAY['sulfites']
WHERE id = 'f0000000-0000-4000-8000-000000000007';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=600&q=80',
  allergens = ARRAY['sulfites']
WHERE id = 'f0000000-0000-4000-8000-000000000008';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=600&q=80',
  allergens = ARRAY['sulfites']
WHERE id = 'f0000000-0000-4000-8000-000000000009';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1547595628-c61a29f496f0?w=600&q=80',
  allergens = ARRAY['sulfites']
WHERE id = 'f0000000-0000-4000-8000-000000000010';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=600&q=80',
  allergens = ARRAY['sulfites']
WHERE id = 'f0000000-0000-4000-8000-000000000011';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1436076863939-06870fe779c2?w=600&q=80',
  allergens = ARRAY['gluten']
WHERE id = 'f0000000-0000-4000-8000-000000000012';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=600&q=80',
  allergens = ARRAY['gluten']
WHERE id = 'f0000000-0000-4000-8000-000000000013';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=600&q=80',
  allergens = ARRAY['gluten']
WHERE id = 'f0000000-0000-4000-8000-000000000014';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=600&q=80'
WHERE id = 'f0000000-0000-4000-8000-000000000015';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&q=80'
WHERE id = 'f0000000-0000-4000-8000-000000000016';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=600&q=80'
WHERE id = 'f0000000-0000-4000-8000-000000000017';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&q=80'
WHERE id = 'f0000000-0000-4000-8000-000000000018';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=600&q=80',
  allergens = ARRAY['gluten', 'dairy']
WHERE id = 'f0000000-0000-4000-8000-000000000019';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=80',
  allergens = ARRAY['gluten', 'dairy']
WHERE id = 'f0000000-0000-4000-8000-000000000020';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80',
  allergens = ARRAY['dairy']
WHERE id = 'f0000000-0000-4000-8000-000000000021';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=600&q=80',
  allergens = ARRAY['gluten', 'dairy']
WHERE id = 'f0000000-0000-4000-8000-000000000022';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600&q=80',
  allergens = ARRAY['gluten', 'dairy', 'eggs']
WHERE id = 'f0000000-0000-4000-8000-000000000023';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=600&q=80',
  allergens = ARRAY['gluten', 'dairy', 'eggs']
WHERE id = 'f0000000-0000-4000-8000-000000000024';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&q=80',
  allergens = ARRAY['gluten', 'dairy', 'eggs']
WHERE id = 'f0000000-0000-4000-8000-000000000025';

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

-- ===== Product serve sizes (migration 00013) =====
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS requires_serve_size BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS serve_size_presets TEXT[],
  ADD COLUMN IF NOT EXISTS allow_custom_serve_size BOOLEAN NOT NULL DEFAULT true;

-- ===== Defer payment method (migration 00014) =====
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;

ALTER TABLE orders
  ALTER COLUMN payment_method SET DEFAULT 'unset';

UPDATE orders
SET payment_method = 'unset'
WHERE payment_method = 'online'
  AND payment_status = 'pending'
  AND stripe_payment_intent_id IS NULL;

ALTER TABLE orders
  ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('unset', 'online', 'at_bar', 'card_at_table'));

-- ===== Menu sections (migration 00015) =====
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS menu_section TEXT NOT NULL DEFAULT 'food';

ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_menu_section_check;

ALTER TABLE categories
  ADD CONSTRAINT categories_menu_section_check
  CHECK (menu_section IN ('drinks', 'food', 'desserts'));

UPDATE categories
SET
  name = 'Drinks',
  name_en = 'Drinks',
  sort_order = 0,
  menu_section = 'drinks',
  is_active = true
WHERE id = 'e0000000-0000-4000-8000-000000000001';

UPDATE products
SET category_id = 'e0000000-0000-4000-8000-000000000001'
WHERE location_id = 'b0000000-0000-4000-8000-000000000001'
  AND category_id IN (
    'e0000000-0000-4000-8000-000000000002',
    'e0000000-0000-4000-8000-000000000003',
    'e0000000-0000-4000-8000-000000000004',
    'e0000000-0000-4000-8000-000000000005'
  );

UPDATE categories SET is_active = false
WHERE id IN (
  'e0000000-0000-4000-8000-000000000002',
  'e0000000-0000-4000-8000-000000000003',
  'e0000000-0000-4000-8000-000000000004',
  'e0000000-0000-4000-8000-000000000005'
);

UPDATE categories
SET
  name = 'Food',
  name_en = 'Food',
  sort_order = 1,
  menu_section = 'food',
  is_active = true
WHERE id = 'e0000000-0000-4000-8000-000000000006';

UPDATE categories
SET menu_section = 'desserts', sort_order = 2, is_active = true
WHERE id = 'e0000000-0000-4000-8000-000000000007';

INSERT INTO categories (id, location_id, name, name_en, sort_order, menu_section, is_active)
SELECT
  'e0000000-0000-4000-8000-000000000007',
  'b0000000-0000-4000-8000-000000000001',
  'Desserts',
  'Desserts',
  2,
  'desserts',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE id = 'e0000000-0000-4000-8000-000000000007'
);

INSERT INTO products (id, location_id, category_id, name, description, price, prep_time_minutes, tags, sort_order)
SELECT * FROM (VALUES
  (
    'f0000000-0000-4000-8000-000000000023'::uuid,
    'b0000000-0000-4000-8000-000000000001'::uuid,
    'e0000000-0000-4000-8000-000000000007'::uuid,
    'Tiramisu',
    'Espresso-soaked ladyfingers, mascarpone',
    7.50,
    3,
    ARRAY['popular']::text[],
    0
  ),
  (
    'f0000000-0000-4000-8000-000000000024'::uuid,
    'b0000000-0000-4000-8000-000000000001'::uuid,
    'e0000000-0000-4000-8000-000000000007'::uuid,
    'Cheesecake',
    'New York style, berry compote',
    8.00,
    3,
    NULL::text[],
    1
  ),
  (
    'f0000000-0000-4000-8000-000000000025'::uuid,
    'b0000000-0000-4000-8000-000000000001'::uuid,
    'e0000000-0000-4000-8000-000000000007'::uuid,
    'Chocolate Lava Cake',
    'Warm center, vanilla ice cream',
    9.00,
    8,
    NULL::text[],
    2
  )
) AS v(id, location_id, category_id, name, description, price, prep_time_minutes, tags, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM products WHERE id = 'f0000000-0000-4000-8000-000000000023'
);

UPDATE products
SET
  requires_serve_size = true,
  serve_size_presets = ARRAY['0.2L', '0.3L', '0.5L'],
  allow_custom_serve_size = true
WHERE id IN (
  'f0000000-0000-4000-8000-000000000009',
  'f0000000-0000-4000-8000-000000000010',
  'f0000000-0000-4000-8000-000000000011',
  'f0000000-0000-4000-8000-000000000012',
  'f0000000-0000-4000-8000-000000000013',
  'f0000000-0000-4000-8000-000000000014'
);

-- ===== In-person payment location (migration 00017) =====
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS in_person_payment_location TEXT NOT NULL DEFAULT 'bar';

ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_in_person_payment_location_check;

ALTER TABLE locations
  ADD CONSTRAINT locations_in_person_payment_location_check
  CHECK (in_person_payment_location IN ('bar', 'counter', 'table'));

-- ===== Payment requested alert (migration 00018) =====
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_requested_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_payment_requested
  ON orders (location_id, payment_requested_at)
  WHERE payment_requested_at IS NOT NULL AND payment_status <> 'paid';

-- ===== Fix Aperol Spritz image (migration 00019) =====
UPDATE products
SET
  image_url = 'https://images.unsplash.com/photo-1758218058958-78f40a716c20?w=600&q=80',
  updated_at = now()
WHERE id = 'f0000000-0000-4000-8000-000000000001';

-- ===== Kitchen routing by menu section (migration 00020) =====
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS menu_section TEXT;

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_menu_section_check;

ALTER TABLE order_items
  ADD CONSTRAINT order_items_menu_section_check
  CHECK (menu_section IS NULL OR menu_section IN ('drinks', 'food', 'desserts'));

UPDATE order_items oi
SET menu_section = c.menu_section
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE oi.product_id = p.id
  AND oi.menu_section IS NULL;

UPDATE order_items
SET menu_section = 'food'
WHERE menu_section IS NULL;

ALTER TABLE order_items
  ALTER COLUMN menu_section SET DEFAULT 'food';

ALTER TABLE order_items
  ALTER COLUMN menu_section SET NOT NULL;

-- ===== German VAT tax rates (migration 00021) =====
ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(4,2);
-- NULL = organization default (19%), 7.00 = ermäßigt (food), 19.00 = regulär (drinks)

ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_takeaway BOOLEAN DEFAULT false;

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(4,2) NOT NULL DEFAULT 19.00;

UPDATE order_items
SET tax_rate = 19.00
WHERE tax_rate IS NULL;

-- ===== Fiskaly Cloud TSE (migration 00022) =====
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tse_signature TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tse_data JSONB;

-- ===== Fiskaly per-organization TSS (migration 00023) =====
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS fiskaly_tss_id TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS fiskaly_client_id TEXT;

-- ===== Stripe webhook idempotency (migration 00024) =====
CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_processed
  ON webhook_events (processed_at);

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- ===== Soft deletes + order audit trigger (migration 00025) =====
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_products_active
  ON products (location_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_categories_active
  ON categories (location_id)
  WHERE deleted_at IS NULL;

DROP POLICY IF EXISTS "public_read_tables" ON tables;
CREATE POLICY "public_read_tables" ON tables
  FOR SELECT USING (is_active = true AND deleted_at IS NULL);

DROP POLICY IF EXISTS "public_read_categories" ON categories;
CREATE POLICY "public_read_categories" ON categories
  FOR SELECT USING (is_active = true AND deleted_at IS NULL);

DROP POLICY IF EXISTS "public_read_products" ON products;
CREATE POLICY "public_read_products" ON products
  FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "staff_read_staff" ON staff;
CREATE POLICY "staff_read_staff" ON staff
  FOR SELECT USING (org_id = ANY(get_user_org_ids()) AND deleted_at IS NULL);

CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS UUID[] AS $$
  SELECT ARRAY(
    SELECT org_id
    FROM staff
    WHERE user_id = auth.uid()
      AND is_active = true
      AND deleted_at IS NULL
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_location_ids()
RETURNS UUID[] AS $$
  SELECT ARRAY(
    SELECT COALESCE(s.location_id, l.id)
    FROM staff s
    LEFT JOIN locations l ON l.org_id = s.org_id
    WHERE s.user_id = auth.uid()
      AND s.is_active = true
      AND s.deleted_at IS NULL
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO audit_log (action, order_id, metadata)
    VALUES (
      'status_change',
      NEW.id,
      jsonb_build_object(
        'from', OLD.status,
        'to', NEW.status,
        'changed_at', now()
      )
    );
  END IF;

  IF OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
    INSERT INTO audit_log (action, order_id, metadata)
    VALUES (
      'payment_change',
      NEW.id,
      jsonb_build_object(
        'from', OLD.payment_status,
        'to', NEW.payment_status,
        'changed_at', now()
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_order_audit ON orders;
CREATE TRIGGER trg_order_audit
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION log_order_status_change();

-- Run this ONLY if cloud-setup.sql was already applied.
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT / DROP POLICY IF EXISTS.

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

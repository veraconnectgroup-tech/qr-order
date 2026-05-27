-- Fix wrong Unsplash stock photos for seed cocktails/wines
-- (Espresso Martini showed a book; Gin & Tonic / Whiskey Sour / Malbec reused wrong images)
-- Canonical URLs: src/lib/product-stock-images.ts

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1676471793068-0db319151c3a?w=600&q=80',
  updated_at = now()
WHERE id = 'f0000000-0000-4000-8000-000000000003';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1627891974481-5566738c3ebf?w=600&q=80',
  updated_at = now()
WHERE id = 'f0000000-0000-4000-8000-000000000007';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1594655885211-f9985d98a4c6?w=600&q=80',
  updated_at = now()
WHERE id = 'f0000000-0000-4000-8000-000000000008';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1598430721694-da039e2fe585?w=600&q=80',
  updated_at = now()
WHERE id = 'f0000000-0000-4000-8000-000000000011';

-- Fix broken/outdated demo product photos (run on existing Supabase projects)
-- Same URLs as 00005_product_images.sql / src/lib/product-stock-images.ts

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1595475207225-428b62bda831?w=600&q=80',
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

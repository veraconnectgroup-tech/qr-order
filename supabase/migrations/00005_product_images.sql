-- Demo product photos + allergens (Skyline Lounge)

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

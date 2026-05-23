-- Fix wrong Unsplash image (watermelon) for Aperol Spritz
UPDATE products
SET
  image_url = 'https://images.unsplash.com/photo-1758218058958-78f40a716c20?w=600&q=80',
  updated_at = now()
WHERE id = 'f0000000-0000-4000-8000-000000000001';

-- Top-level menu sections: drinks, food, desserts

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS menu_section TEXT NOT NULL DEFAULT 'food';

ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_menu_section_check;

ALTER TABLE categories
  ADD CONSTRAINT categories_menu_section_check
  CHECK (menu_section IN ('drinks', 'food', 'desserts'));

UPDATE categories SET menu_section = 'drinks' WHERE id = 'e0000000-0000-4000-8000-000000000001';
UPDATE categories SET menu_section = 'food' WHERE id = 'e0000000-0000-4000-8000-000000000006';
UPDATE categories SET menu_section = 'desserts' WHERE id = 'e0000000-0000-4000-8000-000000000007';

-- Skyline Lounge demo: consolidate legacy subcategories into Drinks / Food / Desserts
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

UPDATE categories
SET is_active = false
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

INSERT INTO categories (id, location_id, name, name_en, sort_order, menu_section, is_active)
VALUES (
  'e0000000-0000-4000-8000-000000000007',
  'b0000000-0000-4000-8000-000000000001',
  'Desserts',
  'Desserts',
  2,
  'desserts',
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  name_en = EXCLUDED.name_en,
  sort_order = EXCLUDED.sort_order,
  menu_section = EXCLUDED.menu_section,
  is_active = EXCLUDED.is_active;

INSERT INTO products (id, location_id, category_id, name, description, price, prep_time_minutes, tags, sort_order)
VALUES
  (
    'f0000000-0000-4000-8000-000000000023',
    'b0000000-0000-4000-8000-000000000001',
    'e0000000-0000-4000-8000-000000000007',
    'Tiramisu',
    'Espresso-soaked ladyfingers, mascarpone',
    7.50,
    3,
    ARRAY['popular'],
    0
  ),
  (
    'f0000000-0000-4000-8000-000000000024',
    'b0000000-0000-4000-8000-000000000001',
    'e0000000-0000-4000-8000-000000000007',
    'Cheesecake',
    'New York style, berry compote',
    8.00,
    3,
    NULL,
    1
  ),
  (
    'f0000000-0000-4000-8000-000000000025',
    'b0000000-0000-4000-8000-000000000001',
    'e0000000-0000-4000-8000-000000000007',
    'Chocolate Lava Cake',
    'Warm center, vanilla ice cream',
    9.00,
    8,
    NULL,
    2
  )
ON CONFLICT (id) DO NOTHING;

-- Serve sizes for tap wine & beer
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

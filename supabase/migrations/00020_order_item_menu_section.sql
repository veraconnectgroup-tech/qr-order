-- Route kitchen tickets by menu section (food/desserts vs drinks)
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

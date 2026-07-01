-- Product semantic metadata for Denis AI (regex-free menu/drink/kitchen classification).
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS drink_family TEXT,
  ADD COLUMN IF NOT EXISTS food_tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS prep_station TEXT;

COMMENT ON COLUMN products.drink_family IS 'Denis drink taxonomy: beer, wine_red, wine_white, cocktail, spirit, coffee, non_alcoholic';
COMMENT ON COLUMN products.food_tags IS 'Food pairing tags: steak, fish, grilled, spicy, dessert, etc.';
COMMENT ON COLUMN products.prep_station IS 'Kitchen prep station: grill, fryer, salad, cold, bar';

CREATE INDEX IF NOT EXISTS idx_products_drink_family
  ON products (location_id, drink_family)
  WHERE drink_family IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_prep_station
  ON products (location_id, prep_station)
  WHERE prep_station IS NOT NULL;

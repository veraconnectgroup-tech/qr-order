-- Product availability toggle (in stock / out of stock, no quantity tracking)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_products_available
  ON products (location_id, is_available);

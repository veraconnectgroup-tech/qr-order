-- W3 — optional per-product stock tracking (Denis inventory awareness)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS track_stock boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stock_quantity integer;

COMMENT ON COLUMN products.track_stock IS
  'When true, stock_quantity decrements on order; auto-86 at 0';
COMMENT ON COLUMN products.stock_quantity IS
  'Remaining portions; null when track_stock is false';

-- Staff order entry: track who created the order and its source channel.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS created_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_source TEXT NOT NULL DEFAULT 'qr';

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_source_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_order_source_check
  CHECK (order_source IN ('qr', 'staff', 'kiosk'));

CREATE INDEX IF NOT EXISTS idx_orders_created_by_staff
  ON orders(created_by_staff_id)
  WHERE created_by_staff_id IS NOT NULL;

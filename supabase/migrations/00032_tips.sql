-- Waiter assigned to a table (tip recipient)
ALTER TABLE tables ADD COLUMN IF NOT EXISTS assigned_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL;

-- Tip on order (MwSt-free in DE; not included in order subtotal/tax)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tip_amount DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tip_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_tip_staff ON orders (tip_staff_id)
  WHERE tip_staff_id IS NOT NULL;

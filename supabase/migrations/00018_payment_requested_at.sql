-- Guest confirmed they want to pay (staff realtime alert)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_requested_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_payment_requested
  ON orders (location_id, payment_requested_at)
  WHERE payment_requested_at IS NOT NULL AND payment_status <> 'paid';

-- Refund tracking on orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_by UUID REFERENCES staff(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

-- Audit log for sensitive actions
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  amount DECIMAL(10,2),
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read own org audit log" ON audit_log
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM orders WHERE location_id = ANY(get_user_location_ids())
    )
    OR staff_id IN (
      SELECT id FROM staff WHERE org_id = ANY(get_user_org_ids())
    )
  );

CREATE POLICY "Service role manages audit log" ON audit_log
  FOR ALL USING (false);

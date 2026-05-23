-- Split bill payments (multiple Stripe PaymentIntents per order)
CREATE TABLE IF NOT EXISTS split_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  tip_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  stripe_payment_intent_id TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'processing', 'paid', 'failed')),
  paid_by_session_id UUID REFERENCES table_sessions(id) ON DELETE SET NULL,
  items JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_split_payments_order ON split_payments (order_id);
CREATE INDEX IF NOT EXISTS idx_split_payments_pi ON split_payments (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_split BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE split_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guest_own_splits" ON split_payments
  FOR SELECT USING (
    paid_by_session_id::text = current_setting('request.jwt.claims', true)::json->>'session_id'
  );

CREATE POLICY "staff_read_split_payments" ON split_payments
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM orders WHERE location_id = ANY(get_user_location_ids())
    )
  );

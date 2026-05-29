-- POS Speed P1: idempotent staff order sync (clientOrderId → order_id)

CREATE TABLE IF NOT EXISTS staff_order_idempotency (
  client_order_id UUID PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES staff(id),
  location_id UUID NOT NULL REFERENCES locations(id),
  order_id UUID NOT NULL REFERENCES orders(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_order_idempotency_staff_created
  ON staff_order_idempotency (staff_id, created_at);

COMMENT ON TABLE staff_order_idempotency IS
  'Maps client-generated order UUIDs to server orders — POS Speed M1 idempotent sync.';

ALTER TABLE staff_order_idempotency ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_staff_order_idempotency ON staff_order_idempotency
  FOR ALL
  USING (auth.role() = 'service_role');

-- ROLLBACK (manual):
-- DROP POLICY IF EXISTS service_role_staff_order_idempotency ON staff_order_idempotency;
-- DROP TABLE IF EXISTS staff_order_idempotency;

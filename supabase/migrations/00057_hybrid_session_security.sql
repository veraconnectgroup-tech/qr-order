-- Hybrid session security: waiter approval, table PIN, trusted devices

-- Session billing lifecycle (session stays open until bill settled)
ALTER TABLE table_sessions
  ADD COLUMN IF NOT EXISTS order_pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS order_pin_set_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bill_status TEXT NOT NULL DEFAULT 'open'
    CHECK (bill_status IN ('open', 'settled', 'void'));

-- Trusted devices per session (valid while session active + bill open)
CREATE TABLE IF NOT EXISTS session_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES table_sessions(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  device_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  pin_verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, device_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_session_devices_token
  ON session_devices (device_token)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_session_devices_session
  ON session_devices (session_id)
  WHERE revoked_at IS NULL;

-- Guest orders: device binding + approval flow
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS device_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS requires_session_open BOOLEAN NOT NULL DEFAULT false;

-- Extend order status for first-order approval gate
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'pending_approval',
    'pending',
    'accepted',
    'preparing',
    'ready',
    'delivered',
    'rejected',
    'cancelled'
  ));

-- Audit log: session-level events
ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES table_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS table_id UUID REFERENCES tables(id) ON DELETE SET NULL;

-- Realtime for approval queue
ALTER TABLE session_devices REPLICA IDENTITY FULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'session_devices'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE session_devices;
  END IF;
END $$;

ALTER TABLE session_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_session_devices ON session_devices
  FOR ALL USING (false);

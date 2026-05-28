-- ADR-019 Phase D: guest Web Push subscriptions per table session

CREATE TABLE IF NOT EXISTS guest_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES table_sessions(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_guest_push_subscriptions_session
  ON guest_push_subscriptions (session_id);

COMMENT ON TABLE guest_push_subscriptions IS
  'Guest PWA push endpoints scoped to table_session — PROJECT.notify (ADR-019 Phase D).';

ALTER TABLE guest_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_guest_push ON guest_push_subscriptions
  FOR ALL
  USING (auth.role() = 'service_role');

-- ROLLBACK (manual):
-- DROP POLICY IF EXISTS service_role_guest_push ON guest_push_subscriptions;
-- DROP TABLE IF EXISTS guest_push_subscriptions;

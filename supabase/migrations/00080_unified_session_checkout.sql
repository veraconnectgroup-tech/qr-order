-- H3: Unified session checkout — outbox session domain, payment intents, POS outbound audit.
-- Depends on 00078 (payment_status pos_online), 00079 (session lifecycle).

-- ===== outbox: session domain for session.paid_online =====
ALTER TABLE outbox_events DROP CONSTRAINT IF EXISTS outbox_events_domain_check;

ALTER TABLE outbox_events
  ADD CONSTRAINT outbox_events_domain_check
  CHECK (domain IN ('fulfillment', 'fiscal', 'integration', 'session'));

-- ===== session_payment_intents (multi-order Stripe checkout) =====
CREATE TABLE IF NOT EXISTS session_payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES table_sessions(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  amount_cents INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, idempotency_key),
  UNIQUE (stripe_payment_intent_id)
);

CREATE INDEX IF NOT EXISTS idx_session_payment_intents_session
  ON session_payment_intents (session_id);

ALTER TABLE session_payment_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_select_session_payment_intents" ON session_payment_intents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM table_sessions ts
      WHERE ts.id = session_payment_intents.session_id
        AND ts.location_id = ANY(get_user_location_ids())
    )
  );

CREATE TRIGGER trg_session_payment_intents_updated_at
  BEFORE UPDATE ON session_payment_intents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ===== pos_outbound_events (POS payment notify audit) =====
CREATE TABLE IF NOT EXISTS pos_outbound_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_integration_id UUID NOT NULL REFERENCES pos_integrations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pos_outbound_events_integration
  ON pos_outbound_events (pos_integration_id, created_at DESC);

ALTER TABLE pos_outbound_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_select_pos_outbound_events" ON pos_outbound_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM pos_integrations pi
      WHERE pi.id = pos_outbound_events.pos_integration_id
        AND pi.location_id = ANY(get_user_location_ids())
    )
  );

-- ===== unpaid session orders index (include pos_online as settled) =====
DROP INDEX IF EXISTS idx_orders_session_unpaid;

CREATE INDEX IF NOT EXISTS idx_orders_session_unpaid
  ON orders (session_id, payment_status)
  WHERE payment_status NOT IN ('paid', 'pos_online', 'refunded');

COMMENT ON TABLE session_payment_intents IS
  'Session-scoped Stripe payment intents for unified table checkout (Track H3).';
COMMENT ON TABLE pos_outbound_events IS
  'Audit log for outbound POS notifications (e.g. session.paid_online).';

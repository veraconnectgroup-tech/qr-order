-- ADR-001 Track A1: order audit log + transactional outbox

CREATE TABLE IF NOT EXISTS order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  idempotency_key TEXT,
  actor_type TEXT,
  actor_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT order_events_idempotency_unique
    UNIQUE NULLS NOT DISTINCT (order_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_order_events_order_id
  ON order_events (order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type TEXT NOT NULL DEFAULT 'order',
  aggregate_id UUID NOT NULL,
  domain TEXT NOT NULL CHECK (domain IN ('fulfillment', 'fiscal', 'integration')),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 10,
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending
  ON outbox_events (next_retry_at)
  WHERE status IN ('pending', 'failed') AND attempts < max_attempts;

CREATE INDEX IF NOT EXISTS idx_outbox_aggregate
  ON outbox_events (aggregate_type, aggregate_id);

COMMENT ON TABLE order_events IS 'Append-only audit log for order lifecycle (ADR-001).';
COMMENT ON TABLE outbox_events IS 'Transactional outbox for fulfillment, fiscal, and integration side effects.';

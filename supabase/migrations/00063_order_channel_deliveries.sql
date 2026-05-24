-- ADR-001: per-channel delivery audit (multi-channel kitchen dispatch)

CREATE TABLE IF NOT EXISTS order_channel_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('dashboard', 'pos', 'cloud_print', 'webhook')),
  provider TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('pending', 'delivered', 'failed', 'skipped')),
  external_id TEXT,
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, channel, provider)
);

CREATE INDEX IF NOT EXISTS idx_order_channel_deliveries_order
  ON order_channel_deliveries (order_id);

COMMENT ON TABLE order_channel_deliveries IS 'Per-channel delivery audit for multi-channel kitchen dispatch.';

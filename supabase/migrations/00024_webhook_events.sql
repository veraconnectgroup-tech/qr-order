CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_processed
  ON webhook_events (processed_at);

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

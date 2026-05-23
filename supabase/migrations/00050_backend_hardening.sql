-- Backend hardening: webhook retry safety + one active session per table.

ALTER TABLE webhook_events
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed';

CREATE INDEX IF NOT EXISTS idx_webhook_events_status
  ON webhook_events (status)
  WHERE status = 'processing';

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_session_per_table
  ON table_sessions (table_id)
  WHERE status = 'active';

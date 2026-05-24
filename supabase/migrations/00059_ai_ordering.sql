-- AI conversational ordering: draft state + audit events

ALTER TABLE ai_sessions
  ADD COLUMN IF NOT EXISTS order_draft JSONB,
  ADD COLUMN IF NOT EXISTS linked_order_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_order_status_snapshot JSONB;

CREATE TABLE IF NOT EXISTS ai_order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_session_id UUID NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'draft_updated',
      'cart_applied',
      'submit_requested',
      'order_created',
      'status_notified'
    )
  ),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_order_events_session
  ON ai_order_events (ai_session_id, created_at DESC);

ALTER TABLE ai_order_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_ai_order_events" ON ai_order_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ai_sessions s
      WHERE s.id = ai_order_events.ai_session_id
        AND s.org_id = ANY(get_user_org_ids())
    )
  );

-- POS outbound webhook audit (payment notify, etc.)

CREATE TABLE IF NOT EXISTS pos_outbound_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_integration_id UUID NOT NULL REFERENCES pos_integrations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
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
      SELECT 1 FROM pos_integrations pi
      WHERE pi.id = pos_outbound_events.pos_integration_id
        AND pi.location_id = ANY(get_user_location_ids())
    )
  );

COMMENT ON TABLE pos_outbound_events IS 'Audit log for Vera → POS outbound notifications.';

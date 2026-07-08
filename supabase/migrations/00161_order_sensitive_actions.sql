-- ADR-044 S1 — standardized sensitive-action journal on order_events (append-only).

ALTER TABLE order_events
  ALTER COLUMN order_id DROP NOT NULL;

ALTER TABLE order_events
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES table_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sensitive_action TEXT,
  ADD COLUMN IF NOT EXISTS target_type TEXT,
  ADD COLUMN IF NOT EXISTS target_id UUID,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS approved_by_staff_id UUID,
  ADD COLUMN IF NOT EXISTS risk_flag BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS context JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_outcome TEXT,
  ADD COLUMN IF NOT EXISTS resolved_by_staff_id UUID;

ALTER TABLE order_events
  ADD CONSTRAINT order_events_sensitive_action_check
    CHECK (
      sensitive_action IS NULL
      OR sensitive_action IN (
        'void',
        'discount',
        'transfer',
        'split',
        'merge',
        'refund',
        'price_override',
        'manager_override',
        'payment_mismatch',
        'session_close'
      )
    );

ALTER TABLE order_events
  ADD CONSTRAINT order_events_target_type_check
    CHECK (
      target_type IS NULL
      OR target_type IN ('order', 'order_item', 'session', 'payment')
    );

ALTER TABLE order_events
  ADD CONSTRAINT order_events_resolved_outcome_check
    CHECK (
      resolved_outcome IS NULL
      OR resolved_outcome IN ('ok', 'problem')
    );

ALTER TABLE order_events
  ADD CONSTRAINT order_events_sensitive_anchor_check
    CHECK (order_id IS NOT NULL OR session_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_order_events_sensitive_action
  ON order_events (sensitive_action, created_at DESC)
  WHERE sensitive_action IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_events_risk_open
  ON order_events (created_at DESC)
  WHERE risk_flag = true AND resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_order_events_session_id
  ON order_events (session_id, created_at DESC)
  WHERE session_id IS NOT NULL;

COMMENT ON COLUMN order_events.sensitive_action IS 'ADR-044 standardized sensitive action type.';
COMMENT ON COLUMN order_events.risk_flag IS 'ADR-044 owner review flag — tone: needs verification, not accusation.';
COMMENT ON COLUMN order_events.context IS 'ADR-044 amounts/tables before-after and pattern metadata.';

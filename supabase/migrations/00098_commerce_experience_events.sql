-- ADR-014 CE-1: Commerce experience event store + session projection + atomic command RPC

CREATE TABLE commerce_experience_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES table_sessions(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,

  command_type TEXT NOT NULL,
  event_type TEXT NOT NULL,
  schema_version SMALLINT NOT NULL DEFAULT 1,
  payload JSONB NOT NULL DEFAULT '{}',

  idempotency_key TEXT NOT NULL,
  trace_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (session_id, idempotency_key)
);

CREATE INDEX idx_ce_events_location_time
  ON commerce_experience_events (location_id, created_at DESC);

CREATE INDEX idx_ce_events_type_time
  ON commerce_experience_events (org_id, event_type, created_at DESC);

CREATE INDEX idx_ce_events_session_time
  ON commerce_experience_events (session_id, created_at DESC);

CREATE TABLE guest_session_commerce_state (
  session_id UUID PRIMARY KEY REFERENCES table_sessions(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,

  last_payment_settled_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  last_payment_settled_at TIMESTAMPTZ,
  bill_settled BOOLEAN NOT NULL DEFAULT false,
  feedback_submitted BOOLEAN NOT NULL DEFAULT false,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_guest_session_commerce_location
  ON guest_session_commerce_state (location_id, updated_at DESC);

CREATE OR REPLACE FUNCTION finalize_commerce_experience_command(
  p_org_id UUID,
  p_location_id UUID,
  p_session_id UUID,
  p_order_id UUID,
  p_command_type TEXT,
  p_event_type TEXT,
  p_payload JSONB,
  p_idempotency_key TEXT,
  p_trace_id TEXT DEFAULT NULL,
  p_schema_version SMALLINT DEFAULT 1
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id UUID;
  v_event_id UUID;
  v_payload JSONB;
BEGIN
  IF p_org_id IS NULL OR p_location_id IS NULL OR p_session_id IS NULL THEN
    RAISE EXCEPTION 'finalize_commerce_experience_command: org_id, location_id, session_id required';
  END IF;

  IF NULLIF(trim(p_command_type), '') IS NULL OR NULLIF(trim(p_event_type), '') IS NULL THEN
    RAISE EXCEPTION 'finalize_commerce_experience_command: command_type and event_type required';
  END IF;

  IF NULLIF(trim(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'finalize_commerce_experience_command: idempotency_key required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM table_sessions ts
    JOIN locations loc ON loc.id = ts.location_id
    WHERE ts.id = p_session_id
      AND ts.location_id = p_location_id
      AND loc.org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'finalize_commerce_experience_command: session/org/location mismatch';
  END IF;

  SELECT id INTO v_existing_id
  FROM commerce_experience_events
  WHERE session_id = p_session_id
    AND idempotency_key = p_idempotency_key;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  v_payload := COALESCE(p_payload, '{}'::jsonb);

  INSERT INTO commerce_experience_events (
    org_id,
    location_id,
    session_id,
    order_id,
    command_type,
    event_type,
    schema_version,
    payload,
    idempotency_key,
    trace_id
  )
  VALUES (
    p_org_id,
    p_location_id,
    p_session_id,
    p_order_id,
    p_command_type,
    p_event_type,
    COALESCE(p_schema_version, 1),
    v_payload,
    p_idempotency_key,
    NULLIF(trim(p_trace_id), '')
  )
  RETURNING id INTO v_event_id;

  INSERT INTO outbox_events (
    aggregate_type,
    aggregate_id,
    domain,
    event_type,
    payload
  )
  VALUES (
    'session',
    p_session_id,
    'commerce',
    'commerce.projection.refresh',
    jsonb_build_object(
      'commerceEventId', v_event_id,
      'sessionId', p_session_id,
      'eventType', p_event_type,
      'traceId', NULLIF(trim(p_trace_id), '')
    )
  );

  RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION finalize_commerce_experience_command(
  UUID, UUID, UUID, UUID, TEXT, TEXT, JSONB, TEXT, TEXT, SMALLINT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION finalize_commerce_experience_command(
  UUID, UUID, UUID, UUID, TEXT, TEXT, JSONB, TEXT, TEXT, SMALLINT
) TO service_role;

COMMENT ON FUNCTION finalize_commerce_experience_command IS
  'ADR-014 CE-1: append commerce_experience_events + commerce.projection.refresh outbox — one transaction';

COMMENT ON TABLE commerce_experience_events IS
  'ADR-014 append-only commerce experience timeline. No UPDATE/DELETE.';

COMMENT ON TABLE guest_session_commerce_state IS
  'ADR-014 CQRS read model for session commerce moments; rebuilt from events.';

-- Extend outbox domain for commerce handlers
ALTER TABLE outbox_events DROP CONSTRAINT IF EXISTS outbox_events_domain_check;

ALTER TABLE outbox_events
  ADD CONSTRAINT outbox_events_domain_check
  CHECK (domain IN ('fulfillment', 'fiscal', 'integration', 'session', 'billing', 'commerce'));

-- RLS: staff read org-scoped; writes via SECURITY DEFINER RPC only
ALTER TABLE commerce_experience_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_session_commerce_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY commerce_events_org_read ON commerce_experience_events
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM staff
      WHERE user_id = auth.uid() AND is_active = true AND deleted_at IS NULL
    )
  );

CREATE POLICY guest_session_commerce_state_org_read ON guest_session_commerce_state
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM staff
      WHERE user_id = auth.uid() AND is_active = true AND deleted_at IS NULL
    )
  );

-- Rollback:
-- DROP POLICY IF EXISTS guest_session_commerce_state_org_read ON guest_session_commerce_state;
-- DROP POLICY IF EXISTS commerce_events_org_read ON commerce_experience_events;
-- ALTER TABLE outbox_events DROP CONSTRAINT IF EXISTS outbox_events_domain_check;
-- ALTER TABLE outbox_events ADD CONSTRAINT outbox_events_domain_check
--   CHECK (domain IN ('fulfillment', 'fiscal', 'integration', 'session', 'billing'));
-- DROP FUNCTION IF EXISTS finalize_commerce_experience_command;
-- DROP TABLE IF EXISTS guest_session_commerce_state, commerce_experience_events;

-- ADR-014 CE-2: Feedback v2 — extend order_feedback, feedback_inbox, RPC dual-write

ALTER TABLE order_feedback
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES table_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sentiment TEXT CHECK (sentiment IS NULL OR sentiment IN ('positive', 'neutral', 'negative')),
  ADD COLUMN IF NOT EXISTS category TEXT CHECK (category IS NULL OR category IN ('food', 'service', 'wait_time', 'other')),
  ADD COLUMN IF NOT EXISTS guest_token TEXT,
  ADD COLUMN IF NOT EXISTS google_review_clicked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS staff_response TEXT,
  ADD COLUMN IF NOT EXISTS responded_by UUID,
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trigger_moment TEXT NOT NULL DEFAULT 'order_delivered'
    CHECK (trigger_moment IN ('session_bill', 'order_delivered', 'payment'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_session
  ON order_feedback (session_id)
  WHERE session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS feedback_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES table_sessions(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  commerce_event_id UUID NOT NULL REFERENCES commerce_experience_events(id) ON DELETE CASCADE,
  sentiment TEXT NOT NULL CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  category TEXT CHECK (category IS NULL OR category IN ('food', 'service', 'wait_time', 'other')),
  rating INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  comment TEXT,
  needs_response BOOLEAN NOT NULL DEFAULT false,
  staff_response TEXT,
  responded_by UUID,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_inbox_event
  ON feedback_inbox (commerce_event_id);

CREATE INDEX IF NOT EXISTS idx_feedback_inbox_location
  ON feedback_inbox (location_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_inbox_needs_response
  ON feedback_inbox (location_id, needs_response, created_at DESC)
  WHERE needs_response = true;

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
  v_rating INTEGER;
  v_sentiment TEXT;
  v_comment TEXT;
  v_category TEXT;
  v_trigger_moment TEXT;
  v_order_id UUID;
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

  IF p_command_type = 'SubmitFeedback' THEN
    IF EXISTS (
      SELECT 1 FROM order_feedback WHERE session_id = p_session_id
    ) OR EXISTS (
      SELECT 1 FROM guest_session_commerce_state
      WHERE session_id = p_session_id AND feedback_submitted = true
    ) THEN
      RAISE EXCEPTION 'feedback_already_submitted' USING ERRCODE = '23505';
    END IF;
  END IF;

  SELECT id INTO v_existing_id
  FROM commerce_experience_events
  WHERE session_id = p_session_id
    AND idempotency_key = p_idempotency_key;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  v_payload := COALESCE(p_payload, '{}'::jsonb);
  v_order_id := COALESCE(p_order_id, NULLIF(v_payload->>'orderId', '')::uuid);

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
    v_order_id,
    p_command_type,
    p_event_type,
    COALESCE(p_schema_version, 1),
    v_payload,
    p_idempotency_key,
    NULLIF(trim(p_trace_id), '')
  )
  RETURNING id INTO v_event_id;

  IF p_command_type = 'SubmitFeedback' THEN
    v_rating := NULLIF(v_payload->>'rating', '')::integer;
    v_sentiment := NULLIF(v_payload->>'sentiment', '');
    v_comment := NULLIF(v_payload->>'comment', '');
    v_category := NULLIF(v_payload->>'category', '');
    v_trigger_moment := COALESCE(NULLIF(v_payload->>'triggerMoment', ''), 'order_delivered');

    IF v_rating IS NULL OR v_sentiment IS NULL THEN
      RAISE EXCEPTION 'SubmitFeedback requires rating and sentiment in payload';
    END IF;

    INSERT INTO order_feedback (
      order_id,
      location_id,
      org_id,
      session_id,
      rating,
      comment,
      sentiment,
      category,
      trigger_moment
    )
    VALUES (
      v_order_id,
      p_location_id,
      p_org_id,
      p_session_id,
      v_rating,
      v_comment,
      v_sentiment,
      v_category,
      v_trigger_moment
    );

    INSERT INTO feedback_inbox (
      org_id,
      location_id,
      session_id,
      order_id,
      commerce_event_id,
      sentiment,
      category,
      rating,
      comment,
      needs_response
    )
    VALUES (
      p_org_id,
      p_location_id,
      p_session_id,
      v_order_id,
      v_event_id,
      v_sentiment,
      v_category,
      v_rating,
      v_comment,
      v_sentiment = 'negative'
    );

    IF v_sentiment = 'negative' THEN
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
        'commerce.alert.staff',
        jsonb_build_object(
          'commerceEventId', v_event_id,
          'sessionId', p_session_id,
          'locationId', p_location_id,
          'orgId', p_org_id,
          'orderId', v_order_id,
          'sentiment', v_sentiment,
          'category', v_category,
          'traceId', NULLIF(trim(p_trace_id), '')
        )
      );
    END IF;
  END IF;

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

COMMENT ON FUNCTION finalize_commerce_experience_command IS
  'ADR-014 CE-2: append commerce event + projection outbox; SubmitFeedback dual-writes order_feedback + inbox';

ALTER TABLE feedback_inbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY feedback_inbox_org_read ON feedback_inbox
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM staff
      WHERE user_id = auth.uid() AND is_active = true AND deleted_at IS NULL
    )
  );

-- Rollback:
-- DROP POLICY IF EXISTS feedback_inbox_org_read ON feedback_inbox;
-- DROP TABLE IF EXISTS feedback_inbox;
-- DROP INDEX IF EXISTS idx_feedback_session;
-- ALTER TABLE order_feedback DROP COLUMN IF EXISTS session_id, ...;

-- Q1: Google review funnel anti-spam on guest memory

ALTER TABLE denis_guest_memory
  ADD COLUMN IF NOT EXISTS last_review_prompt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_review_dismiss_at TIMESTAMPTZ;

COMMENT ON COLUMN denis_guest_memory.last_review_prompt_at IS
  'Last time Denis showed Google review prompt — max 1 per 90 days (Q1).';
COMMENT ON COLUMN denis_guest_memory.last_review_dismiss_at IS
  'Guest tapped Not now on Google review — suppress 180 days (Q1).';

-- Extend commerce finalize for review click tracking
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

  IF p_command_type = 'RecordGoogleReviewClick' THEN
    UPDATE order_feedback
    SET google_review_clicked = true
    WHERE session_id = p_session_id;
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

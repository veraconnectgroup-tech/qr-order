-- ADR-009 F2: atomic turn metering (debit + billing timeline + session credits_used)

CREATE OR REPLACE FUNCTION finalize_denis_turn_metering(
  p_org_id UUID,
  p_ai_session_id UUID,
  p_amount INTEGER,
  p_trace_id TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INTEGER;
  v_payload JSONB;
BEGIN
  IF p_org_id IS NULL OR p_ai_session_id IS NULL THEN
    RAISE EXCEPTION 'finalize_denis_turn_metering: org_id and ai_session_id required';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'finalize_denis_turn_metering: amount must be a positive integer';
  END IF;

  UPDATE ai_credits
  SET
    balance = balance - p_amount,
    lifetime_used = lifetime_used + p_amount,
    updated_at = now()
  WHERE org_id = p_org_id
    AND balance >= p_amount
  RETURNING balance INTO v_balance;

  IF NOT FOUND THEN
    RETURN -1;
  END IF;

  v_payload := COALESCE(p_payload, '{}'::jsonb)
    || jsonb_build_object(
      'balanceAfter', v_balance,
      'amount', p_amount,
      'traceId', NULLIF(trim(p_trace_id), '')
    );

  PERFORM append_denis_timeline_event(
    p_ai_session_id,
    'billing.turn_debited',
    v_payload,
    p_trace_id,
    NULL
  );

  UPDATE ai_sessions
  SET credits_used = credits_used + p_amount
  WHERE id = p_ai_session_id;

  RETURN v_balance;
END;
$$;

REVOKE ALL ON FUNCTION finalize_denis_turn_metering(UUID, UUID, INTEGER, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finalize_denis_turn_metering(UUID, UUID, INTEGER, TEXT, JSONB) TO service_role;

COMMENT ON FUNCTION finalize_denis_turn_metering IS
  'ADR-009 F2: debit ai_credits, append billing.turn_debited, bump session credits_used — one transaction';

-- ADR-009 F4: allow billing domain on outbox
ALTER TABLE outbox_events DROP CONSTRAINT IF EXISTS outbox_events_domain_check;

ALTER TABLE outbox_events
  ADD CONSTRAINT outbox_events_domain_check
  CHECK (domain IN ('fulfillment', 'fiscal', 'integration', 'session', 'billing'));

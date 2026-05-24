-- ADR-001 A3: atomic outbox claim (FOR UPDATE SKIP LOCKED)

CREATE OR REPLACE FUNCTION claim_outbox_events(p_limit int DEFAULT 50)
RETURNS SETOF outbox_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE outbox_events o
  SET
    status = 'processing',
    attempts = o.attempts + 1
  FROM (
    SELECT id
    FROM outbox_events
    WHERE status IN ('pending', 'failed')
      AND attempts < max_attempts
      AND next_retry_at <= now()
    ORDER BY next_retry_at ASC, created_at ASC
    LIMIT LEAST(GREATEST(p_limit, 1), 50)
    FOR UPDATE SKIP LOCKED
  ) picked
  WHERE o.id = picked.id
  RETURNING o.*;
END;
$$;

CREATE OR REPLACE FUNCTION complete_outbox_event(
  p_id uuid,
  p_success boolean,
  p_error text DEFAULT NULL,
  p_next_retry_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempts int;
  v_max_attempts int;
BEGIN
  SELECT attempts, max_attempts
  INTO v_attempts, v_max_attempts
  FROM outbox_events
  WHERE id = p_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF p_success THEN
    UPDATE outbox_events
    SET
      status = 'done',
      last_error = NULL,
      processed_at = now()
    WHERE id = p_id;
    RETURN;
  END IF;

  IF v_attempts >= v_max_attempts THEN
    UPDATE outbox_events
    SET
      status = 'failed',
      last_error = LEFT(COALESCE(p_error, 'unknown error'), 2000),
      processed_at = now()
    WHERE id = p_id;
    RETURN;
  END IF;

  UPDATE outbox_events
  SET
    status = 'pending',
    last_error = LEFT(COALESCE(p_error, 'unknown error'), 2000),
    next_retry_at = COALESCE(p_next_retry_at, now() + interval '30 seconds')
  WHERE id = p_id;
END;
$$;

COMMENT ON FUNCTION claim_outbox_events IS 'Claim pending outbox rows with SKIP LOCKED (ADR-001 A3).';
COMMENT ON FUNCTION complete_outbox_event IS 'Mark outbox row done, retry, or dead-letter failed.';

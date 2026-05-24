-- Consume promo code when staff approves a pending_approval order (not at creation).
-- Rollback: re-run 00065_approve_order_access_rpc.sql to restore prior function body.

CREATE OR REPLACE FUNCTION approve_order_access_tx(
  p_order_id UUID,
  p_staff_id UUID,
  p_pin_hash TEXT,
  p_device_fingerprint TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_session table_sessions%ROWTYPE;
  v_now TIMESTAMPTZ := now();
  v_pin_was_new BOOLEAN := false;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  IF v_order.status = 'pending'
     AND v_order.session_id IS NOT NULL
     AND NOT COALESCE(v_order.requires_session_open, false) THEN
    SELECT * INTO v_session FROM table_sessions WHERE id = v_order.session_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'session_not_found';
    END IF;
    RETURN jsonb_build_object(
      'session_id', v_session.id,
      'session_token', v_session.session_token,
      'order_number', v_order.order_number,
      'already_approved', true,
      'pin_was_new', false
    );
  END IF;

  IF v_order.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'order_not_awaiting_approval';
  END IF;

  IF v_order.table_id IS NULL THEN
    RAISE EXCEPTION 'order_no_table';
  END IF;

  SELECT * INTO v_session
  FROM table_sessions
  WHERE table_id = v_order.table_id
    AND status = 'active'
    AND bill_status = 'open'
  LIMIT 1;

  IF NOT FOUND THEN
    IF p_pin_hash IS NULL OR p_pin_hash = '' THEN
      RAISE EXCEPTION 'pin_hash_required';
    END IF;

    BEGIN
      INSERT INTO table_sessions (
        table_id,
        location_id,
        status,
        bill_status,
        order_pin_hash,
        order_pin_set_at,
        approved_by_staff_id
      ) VALUES (
        v_order.table_id,
        v_order.location_id,
        'active',
        'open',
        p_pin_hash,
        v_now,
        p_staff_id
      )
      RETURNING * INTO v_session;

      v_pin_was_new := true;
    EXCEPTION
      WHEN unique_violation THEN
        SELECT * INTO v_session
        FROM table_sessions
        WHERE table_id = v_order.table_id
          AND status = 'active'
          AND bill_status = 'open'
        LIMIT 1;
    END;
  END IF;

  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'session_create_failed';
  END IF;

  UPDATE orders
  SET
    session_id = v_session.id,
    status = 'pending',
    requires_session_open = false,
    updated_at = v_now
  WHERE id = p_order_id
    AND status = 'pending_approval';

  IF NOT FOUND THEN
    SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
    IF v_order.status = 'pending'
       AND v_order.session_id IS NOT NULL
       AND NOT COALESCE(v_order.requires_session_open, false) THEN
      SELECT * INTO v_session FROM table_sessions WHERE id = v_order.session_id;
      RETURN jsonb_build_object(
        'session_id', v_session.id,
        'session_token', v_session.session_token,
        'order_number', v_order.order_number,
        'already_approved', true,
        'pin_was_new', false
      );
    END IF;
    RAISE EXCEPTION 'order_update_failed';
  END IF;

  IF v_order.promo_code_id IS NOT NULL THEN
    PERFORM increment_promo_used_count(v_order.promo_code_id);
  END IF;

  IF p_device_fingerprint IS NOT NULL AND length(p_device_fingerprint) >= 8 THEN
    INSERT INTO session_devices (
      session_id,
      device_fingerprint,
      user_agent,
      pin_verified_at,
      last_seen_at
    ) VALUES (
      v_session.id,
      p_device_fingerprint,
      p_user_agent,
      v_now,
      v_now
    )
    ON CONFLICT (session_id, device_fingerprint) DO UPDATE
    SET
      revoked_at = NULL,
      pin_verified_at = v_now,
      last_seen_at = v_now,
      user_agent = COALESCE(EXCLUDED.user_agent, session_devices.user_agent);
  END IF;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'session_token', v_session.session_token,
    'order_number', v_order.order_number,
    'already_approved', false,
    'pin_was_new', v_pin_was_new
  );
END;
$$;

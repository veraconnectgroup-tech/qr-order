-- Atomic guest order creation: order + items + modifiers + optional promo consume (ADR-001)
-- Rollback: DROP FUNCTION IF EXISTS create_guest_order_tx;

CREATE OR REPLACE FUNCTION create_guest_order_tx(
  p_location_id       UUID,
  p_table_id          UUID,
  p_session_id        UUID,
  p_status            TEXT,
  p_requires_session  BOOLEAN,
  p_idempotency_key   TEXT,
  p_order_payload     JSONB,
  p_items             JSONB,
  p_promo_code_id     UUID,
  p_consume_promo     BOOLEAN
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_number INT;
  v_order_id UUID;
  v_item JSONB;
  v_item_id UUID;
BEGIN
  IF p_promo_code_id IS NOT NULL THEN
    PERFORM 1 FROM promo_codes WHERE id = p_promo_code_id FOR UPDATE;
  END IF;

  v_order_number := get_next_order_number(p_location_id);

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_order_id FROM orders
      WHERE idempotency_key = p_idempotency_key LIMIT 1;
    IF FOUND THEN
      RETURN (
        SELECT jsonb_build_object(
          'order_id', o.id,
          'order_number', o.order_number,
          'total', o.total,
          'tax_percent', o.tax_percent,
          'already_existed', true
        )
        FROM orders o
        WHERE o.id = v_order_id
      );
    END IF;
  END IF;

  BEGIN
    INSERT INTO orders (
      location_id, table_id, session_id, order_number,
      subtotal, tax_percent, tax_amount, total,
      discount_amount, promo_code_id, is_takeaway, notes,
      estimated_prep_minutes, status, requires_session_open,
      device_fingerprint, payment_status, payment_method,
      tip_amount, order_source, idempotency_key
    ) VALUES (
      p_location_id, p_table_id, p_session_id, v_order_number,
      (p_order_payload->>'subtotal')::NUMERIC,
      (p_order_payload->>'tax_percent')::NUMERIC,
      (p_order_payload->>'tax_amount')::NUMERIC,
      (p_order_payload->>'total')::NUMERIC,
      (p_order_payload->>'discount_amount')::NUMERIC,
      p_promo_code_id,
      (p_order_payload->>'is_takeaway')::BOOLEAN,
      NULLIF(p_order_payload->>'notes', ''),
      8, p_status, p_requires_session,
      NULLIF(p_order_payload->>'device_fingerprint', ''),
      'pending',
      p_order_payload->>'payment_method',
      0, 'qr', p_idempotency_key
    ) RETURNING id INTO v_order_id;
  EXCEPTION
    WHEN unique_violation THEN
      IF p_idempotency_key IS NOT NULL THEN
        RETURN (
          SELECT jsonb_build_object(
            'order_id', o.id,
            'order_number', o.order_number,
            'total', o.total,
            'tax_percent', o.tax_percent,
            'already_existed', true
          )
          FROM orders o
          WHERE o.idempotency_key = p_idempotency_key
          LIMIT 1
        );
      END IF;
      RAISE;
  END;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO order_items (
      order_id, product_id, product_name, quantity,
      unit_price, notes, total, menu_section, tax_rate
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::UUID,
      v_item->>'product_name',
      (v_item->>'quantity')::INT,
      (v_item->>'unit_price')::NUMERIC,
      NULLIF(v_item->>'notes', ''),
      (v_item->>'total')::NUMERIC,
      v_item->>'menu_section',
      (v_item->>'tax_rate')::NUMERIC
    ) RETURNING id INTO v_item_id;

    IF v_item->'modifiers' IS NOT NULL
       AND jsonb_array_length(v_item->'modifiers') > 0 THEN
      INSERT INTO order_item_modifiers (
        order_item_id, modifier_id, modifier_name, price
      )
      SELECT v_item_id,
        (m->>'modifier_id')::UUID,
        m->>'modifier_name',
        (m->>'price')::NUMERIC
      FROM jsonb_array_elements(v_item->'modifiers') m;
    END IF;
  END LOOP;

  IF p_consume_promo AND p_promo_code_id IS NOT NULL THEN
    PERFORM increment_promo_used_count(p_promo_code_id);
  END IF;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'total', (p_order_payload->>'total')::NUMERIC,
    'tax_percent', (p_order_payload->>'tax_percent')::NUMERIC,
    'already_existed', false
  );
END;
$$;

COMMENT ON FUNCTION create_guest_order_tx IS 'Atomic guest order: order + items + modifiers + optional promo consume.';

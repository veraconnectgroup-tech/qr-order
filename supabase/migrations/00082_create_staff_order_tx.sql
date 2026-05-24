-- H9: Atomic staff order creation — order + items + modifiers in one transaction.
-- Rollback: DROP FUNCTION IF EXISTS create_staff_order_tx;

CREATE OR REPLACE FUNCTION create_staff_order_tx(
  p_location_id UUID,
  p_table_id      UUID,
  p_session_id    UUID,
  p_staff_id      UUID,
  p_order_payload JSONB,
  p_items         JSONB
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
  v_now TIMESTAMPTZ := now();
BEGIN
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'session_id required for staff orders';
  END IF;

  IF jsonb_array_length(p_items) < 1 THEN
    RAISE EXCEPTION 'staff order requires at least one item';
  END IF;

  v_order_number := get_next_order_number(p_location_id);

  INSERT INTO orders (
    location_id, table_id, session_id, order_number,
    subtotal, tax_percent, tax_amount, total,
    discount_amount, promo_code_id, is_takeaway, notes,
    estimated_prep_minutes, status, requires_session_open,
    payment_status, payment_method, tip_amount, tip_staff_id,
    order_source, created_by_staff_id,
    accepted_at
  ) VALUES (
    p_location_id, p_table_id, p_session_id, v_order_number,
    (p_order_payload->>'subtotal')::NUMERIC,
    (p_order_payload->>'tax_percent')::NUMERIC,
    (p_order_payload->>'tax_amount')::NUMERIC,
    (p_order_payload->>'total')::NUMERIC,
    0, NULL,
    COALESCE((p_order_payload->>'is_takeaway')::BOOLEAN, false),
    NULLIF(p_order_payload->>'notes', ''),
    COALESCE((p_order_payload->>'estimated_prep_minutes')::INT, 8),
    'accepted', false,
    'pending',
    p_order_payload->>'payment_method',
    0, NULL,
    'staff', p_staff_id,
    v_now
  ) RETURNING id INTO v_order_id;

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

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'total', (p_order_payload->>'total')::NUMERIC,
    'session_id', p_session_id
  );
END;
$$;

COMMENT ON FUNCTION create_staff_order_tx IS
  'Atomic staff order: order + items + modifiers (session must exist).';

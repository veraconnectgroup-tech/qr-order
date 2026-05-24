-- H2: POS inbound — order columns, session lifecycle, audit, atomic create RPC.
-- Depends on 00078 (pos_order_links, pos_table_mappings, order_source pos).
-- Rollback: DROP FUNCTION create_pos_order_tx; drop pos_inbound_events; reverse alters.

-- ===== orders: POS traceability =====
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN (
    'unset', 'online', 'at_bar', 'card_at_table', 'pos', 'pos_online'
  ));

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS pos_integration_id UUID
    REFERENCES pos_integrations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_pos_order_id TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_pos_integration
  ON orders (pos_integration_id)
  WHERE pos_integration_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_session_unpaid
  ON orders (session_id, payment_status)
  WHERE payment_status NOT IN ('paid', 'refunded');

-- ===== table_sessions: lifecycle for POS + unified bill =====
ALTER TABLE table_sessions
  ADD COLUMN IF NOT EXISTS access_state TEXT NOT NULL DEFAULT 'open'
    CHECK (access_state IN ('open', 'locked', 'closing', 'closed')),
  ADD COLUMN IF NOT EXISTS opened_by TEXT NOT NULL DEFAULT 'qr'
    CHECK (opened_by IN ('qr', 'staff', 'pos')),
  ADD COLUMN IF NOT EXISTS closed_by TEXT
    CHECK (closed_by IS NULL OR closed_by IN ('qr', 'staff', 'pos', 'timeout', 'system')),
  ADD COLUMN IF NOT EXISTS pos_table_external_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_authority TEXT NOT NULL DEFAULT 'vera'
    CHECK (payment_authority IN ('vera', 'pos'));

UPDATE table_sessions
SET access_state = 'closed'
WHERE status = 'closed' AND access_state = 'open';

UPDATE table_sessions
SET access_state = 'locked'
WHERE status = 'active'
  AND order_pin_hash IS NOT NULL
  AND access_state = 'open';

-- ===== pos_inbound_events (webhook audit) =====
CREATE TABLE IF NOT EXISTS pos_inbound_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_integration_id UUID NOT NULL REFERENCES pos_integrations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  external_id TEXT,
  payload_hash TEXT NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'received'
    CHECK (processing_status IN (
      'received', 'processed', 'duplicate', 'rejected', 'failed'
    )),
  http_status INT,
  error_message TEXT,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  session_id UUID REFERENCES table_sessions(id) ON DELETE SET NULL,
  duration_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pos_inbound_events_integration
  ON pos_inbound_events (pos_integration_id, created_at DESC);

ALTER TABLE pos_inbound_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_select_pos_inbound_events" ON pos_inbound_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM pos_integrations pi
      WHERE pi.id = pos_inbound_events.pos_integration_id
        AND pi.location_id = ANY(get_user_location_ids())
    )
  );

-- ===== RPC: atomic POS order creation =====
CREATE OR REPLACE FUNCTION create_pos_order_tx(
  p_pos_integration_id UUID,
  p_location_id        UUID,
  p_table_id           UUID,
  p_external_order_id  TEXT,
  p_idempotency_key    TEXT,
  p_order_payload      JSONB,
  p_items              JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_order_id UUID;
  v_session_id UUID;
  v_order_number INT;
  v_order_id UUID;
  v_item JSONB;
  v_item_id UUID;
  v_now TIMESTAMPTZ := now();
  v_payment_status TEXT;
  v_payment_method TEXT;
BEGIN
  SELECT order_id INTO v_existing_order_id
  FROM pos_order_links
  WHERE pos_integration_id = p_pos_integration_id
    AND external_order_id = p_external_order_id
  LIMIT 1;

  IF FOUND THEN
    RETURN (
      SELECT jsonb_build_object(
        'order_id', o.id,
        'order_number', o.order_number,
        'total', o.total,
        'session_id', o.session_id,
        'already_existed', true
      )
      FROM orders o
      WHERE o.id = v_existing_order_id
    );
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_order_id FROM orders
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;
    IF FOUND THEN
      RETURN (
        SELECT jsonb_build_object(
          'order_id', o.id,
          'order_number', o.order_number,
          'total', o.total,
          'session_id', o.session_id,
          'already_existed', true
        )
        FROM orders o
        WHERE o.id = v_order_id
      );
    END IF;
  END IF;

  SELECT id INTO v_session_id
  FROM table_sessions
  WHERE table_id = p_table_id
    AND status = 'active'
    AND bill_status = 'open'
    AND access_state IN ('open', 'locked')
  ORDER BY opened_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    BEGIN
      INSERT INTO table_sessions (
        table_id, location_id, status, bill_status,
        opened_by, access_state, payment_authority
      ) VALUES (
        p_table_id, p_location_id, 'active', 'open',
        'pos', 'open', 'pos'
      )
      RETURNING id INTO v_session_id;
    EXCEPTION
      WHEN unique_violation THEN
        SELECT id INTO v_session_id
        FROM table_sessions
        WHERE table_id = p_table_id
          AND status = 'active'
          AND bill_status = 'open'
        ORDER BY opened_at DESC
        LIMIT 1;
    END;
  END IF;

  v_order_number := get_next_order_number(p_location_id);

  v_payment_status := COALESCE(p_order_payload->>'payment_status', 'pending');
  v_payment_method := COALESCE(p_order_payload->>'payment_method', 'unset');
  IF v_payment_status = 'paid' AND v_payment_method = 'unset' THEN
    v_payment_method := 'pos';
  END IF;

  INSERT INTO orders (
    location_id, table_id, session_id, order_number,
    subtotal, tax_percent, tax_amount, total,
    discount_amount, promo_code_id, is_takeaway, notes,
    estimated_prep_minutes, status, requires_session_open,
    payment_status, payment_method, tip_amount,
    order_source, idempotency_key,
    pos_integration_id, external_pos_order_id,
    accepted_at
  ) VALUES (
    p_location_id, p_table_id, v_session_id, v_order_number,
    (p_order_payload->>'subtotal')::NUMERIC,
    (p_order_payload->>'tax_percent')::NUMERIC,
    (p_order_payload->>'tax_amount')::NUMERIC,
    (p_order_payload->>'total')::NUMERIC,
    0, NULL, false,
    NULLIF(p_order_payload->>'notes', ''),
    8,
    COALESCE(NULLIF(p_order_payload->>'status', ''), 'accepted'),
    false,
    v_payment_status,
    v_payment_method,
    0,
    'pos',
    p_idempotency_key,
    p_pos_integration_id,
    p_external_order_id,
    v_now
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO order_items (
      order_id, product_id, product_name, quantity,
      unit_price, notes, total, menu_section, tax_rate
    ) VALUES (
      v_order_id,
      NULL,
      v_item->>'product_name',
      (v_item->>'quantity')::INT,
      (v_item->>'unit_price')::NUMERIC,
      NULLIF(v_item->>'notes', ''),
      (v_item->>'total')::NUMERIC,
      COALESCE(NULLIF(v_item->>'menu_section', ''), 'food'),
      COALESCE((v_item->>'tax_rate')::NUMERIC, 19)
    ) RETURNING id INTO v_item_id;

    IF v_item->'modifiers' IS NOT NULL
       AND jsonb_array_length(v_item->'modifiers') > 0 THEN
      INSERT INTO order_item_modifiers (
        order_item_id, modifier_id, modifier_name, price
      )
      SELECT v_item_id,
        NULL,
        m->>'modifier_name',
        COALESCE((m->>'price')::NUMERIC, 0)
      FROM jsonb_array_elements(v_item->'modifiers') m;
    END IF;
  END LOOP;

  INSERT INTO pos_order_links (
    pos_integration_id, external_order_id, order_id
  ) VALUES (
    p_pos_integration_id, p_external_order_id, v_order_id
  );

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'total', (p_order_payload->>'total')::NUMERIC,
    'session_id', v_session_id,
    'already_existed', false
  );
END;
$$;

COMMENT ON FUNCTION create_pos_order_tx IS
  'Atomic POS inbound order: session attach, order + items, idempotency link.';
COMMENT ON TABLE pos_inbound_events IS
  'Inbound POS webhook audit log (Track H2).';

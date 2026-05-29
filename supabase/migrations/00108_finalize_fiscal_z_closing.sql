-- ADR-012 FJ-8: Z-Bon / Kassenabschluss as journal z_closing row

CREATE OR REPLACE FUNCTION finalize_fiscal_z_closing(
  p_register_id UUID,
  p_org_id UUID,
  p_location_id UUID,
  p_business_date DATE,
  p_idempotency_key TEXT,
  p_currency TEXT,
  p_gross_total NUMERIC,
  p_net_total NUMERIC,
  p_tax_total NUMERIC,
  p_total_cash NUMERIC,
  p_total_non_cash NUMERIC,
  p_order_count INTEGER,
  p_refund_count INTEGER,
  p_refund_total NUMERIC,
  p_lines JSONB
)
RETURNS TABLE (fiscal_transaction_id UUID, z_nr INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing RECORD;
  v_tx_id UUID;
  v_z_nr INTEGER;
  v_line JSONB;
  v_line_no INTEGER;
BEGIN
  IF p_register_id IS NULL OR p_location_id IS NULL OR p_business_date IS NULL THEN
    RAISE EXCEPTION 'finalize_fiscal_z_closing: register_id, location_id, business_date required';
  END IF;

  SELECT id, z_nr
  INTO v_existing
  FROM fiscal_transactions
  WHERE register_id = p_register_id
    AND idempotency_key = p_idempotency_key
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    fiscal_transaction_id := v_existing.id;
    z_nr := v_existing.z_nr;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT COALESCE(MAX(ft.z_nr), 0) + 1
  INTO v_z_nr
  FROM fiscal_transactions ft
  WHERE ft.register_id = p_register_id
    AND ft.z_nr IS NOT NULL;

  INSERT INTO fiscal_transactions (
    register_id,
    org_id,
    location_id,
    tx_type,
    status,
    currency,
    gross_total,
    net_total,
    tax_total,
    payment_method,
    z_nr,
    business_date,
    idempotency_key
  )
  VALUES (
    p_register_id,
    p_org_id,
    p_location_id,
    'z_closing',
    'pending',
    COALESCE(NULLIF(trim(p_currency), ''), 'EUR'),
    p_gross_total,
    p_net_total,
    p_tax_total,
    'mixed',
    v_z_nr,
    p_business_date,
    p_idempotency_key
  )
  RETURNING id INTO v_tx_id;

  v_line_no := 0;
  FOR v_line IN SELECT * FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb))
  LOOP
    v_line_no := v_line_no + 1;
    INSERT INTO fiscal_transaction_lines (
      fiscal_transaction_id,
      line_no,
      product_name,
      quantity,
      tax_rate,
      gross,
      net,
      tax
    )
    VALUES (
      v_tx_id,
      COALESCE((v_line->>'line_no')::INTEGER, v_line_no),
      COALESCE(v_line->>'product_name', 'Tagesabschluss'),
      COALESCE((v_line->>'quantity')::NUMERIC, 1),
      COALESCE((v_line->>'tax_rate')::NUMERIC, 19),
      COALESCE((v_line->>'gross')::NUMERIC, 0),
      COALESCE((v_line->>'net')::NUMERIC, 0),
      COALESCE((v_line->>'tax')::NUMERIC, 0)
    );
  END LOOP;

  INSERT INTO outbox_events (
    aggregate_type,
    aggregate_id,
    domain,
    event_type,
    payload
  )
  VALUES (
    'location',
    p_location_id,
    'fiscal',
    'fiscal.tse_sign',
    jsonb_build_object(
      'fiscalTransactionId', v_tx_id,
      'locationId', p_location_id,
      'businessDate', p_business_date::TEXT,
      'closingKind', 'z_closing',
      'orderCount', p_order_count,
      'refundCount', p_refund_count,
      'refundTotal', p_refund_total,
      'totalCash', p_total_cash,
      'totalNonCash', p_total_non_cash
    )
  );

  fiscal_transaction_id := v_tx_id;
  z_nr := v_z_nr;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION finalize_fiscal_z_closing(
  UUID, UUID, UUID, DATE, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, INTEGER, INTEGER, NUMERIC, JSONB
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION finalize_fiscal_z_closing(
  UUID, UUID, UUID, DATE, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, INTEGER, INTEGER, NUMERIC, JSONB
) TO service_role;

COMMENT ON FUNCTION finalize_fiscal_z_closing IS
  'ADR-012: INSERT z_closing journal row + lines + z_nr + fiscal.tse_sign outbox';

-- Rollback:
-- DROP FUNCTION IF EXISTS finalize_fiscal_z_closing(
--   UUID, UUID, UUID, DATE, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, INTEGER, INTEGER, NUMERIC, JSONB
-- );

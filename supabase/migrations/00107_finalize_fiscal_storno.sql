-- FJ-5: atomic fiscal storno journal row (sign happens in app layer)

ALTER TABLE storno_records
  ADD COLUMN IF NOT EXISTS fiscal_transaction_id UUID
    REFERENCES fiscal_transactions(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION finalize_fiscal_storno(
  p_order_id UUID,
  p_storno_of_id UUID,
  p_register_id UUID,
  p_idempotency_key TEXT,
  p_org_id UUID,
  p_location_id UUID,
  p_currency TEXT,
  p_gross_total NUMERIC,
  p_net_total NUMERIC,
  p_tax_total NUMERIC,
  p_payment_method TEXT,
  p_payment_type TEXT,
  p_business_date DATE,
  p_lines JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id UUID;
  v_tx_id UUID;
  v_bon_number INTEGER;
  v_line JSONB;
  v_line_no INTEGER;
BEGIN
  IF p_order_id IS NULL OR p_storno_of_id IS NULL OR p_register_id IS NULL THEN
    RAISE EXCEPTION 'finalize_fiscal_storno: order_id, storno_of_id, register_id required';
  END IF;

  SELECT id INTO v_existing_id
  FROM fiscal_transactions
  WHERE register_id = p_register_id
    AND idempotency_key = p_idempotency_key
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM fiscal_transactions
    WHERE id = p_storno_of_id
      AND tx_type = 'sale'
      AND status = 'signed'
  ) THEN
    RAISE EXCEPTION 'finalize_fiscal_storno: parent sale % not signed', p_storno_of_id;
  END IF;

  SELECT COALESCE(MAX(bon_number), 0) + 1
  INTO v_bon_number
  FROM fiscal_transactions
  WHERE register_id = p_register_id;

  INSERT INTO fiscal_transactions (
    register_id,
    org_id,
    location_id,
    tx_type,
    status,
    order_id,
    storno_of_id,
    currency,
    gross_total,
    net_total,
    tax_total,
    payment_method,
    payment_type,
    bon_number,
    business_date,
    idempotency_key
  )
  VALUES (
    p_register_id,
    p_org_id,
    p_location_id,
    'storno',
    'pending',
    p_order_id,
    p_storno_of_id,
    COALESCE(NULLIF(trim(p_currency), ''), 'EUR'),
    p_gross_total,
    p_net_total,
    p_tax_total,
    p_payment_method,
    p_payment_type,
    v_bon_number,
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
      COALESCE(v_line->>'product_name', 'Storno'),
      COALESCE((v_line->>'quantity')::NUMERIC, 1),
      COALESCE((v_line->>'tax_rate')::NUMERIC, 19),
      COALESCE((v_line->>'gross')::NUMERIC, 0),
      COALESCE((v_line->>'net')::NUMERIC, 0),
      COALESCE((v_line->>'tax')::NUMERIC, 0)
    );
  END LOOP;

  RETURN v_tx_id;
END;
$$;

REVOKE ALL ON FUNCTION finalize_fiscal_storno(
  UUID, UUID, UUID, TEXT, UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, DATE, JSONB
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION finalize_fiscal_storno(
  UUID, UUID, UUID, TEXT, UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, DATE, JSONB
) TO service_role;

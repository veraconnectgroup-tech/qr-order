-- H13: Storno records — legal TSE storno audit trail (KassSichV / DSFinV-K).
-- Rollback:
--   DROP POLICY IF EXISTS storno_records_org_insert ON storno_records;
--   DROP POLICY IF EXISTS storno_records_org_read ON storno_records;
--   DROP TABLE IF EXISTS storno_records;
--   ALTER TABLE orders DROP COLUMN IF EXISTS has_storno;
--   ALTER TABLE orders DROP COLUMN IF EXISTS storno_total;

CREATE TABLE storno_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  original_order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  storno_amount NUMERIC(10, 2) NOT NULL,
  storno_reason TEXT NOT NULL,
  storno_type TEXT NOT NULL
    CHECK (storno_type IN ('full', 'partial')),
  performed_by UUID NOT NULL,
  -- TSE storno podaci (novi beleg)
  tse_storno_signature TEXT,
  tse_storno_data JSONB,
  tse_storno_tx_id TEXT,
  -- Referenca na originalni TSE
  original_tse_tx_id TEXT,
  original_tse_signature TEXT,
  -- Stripe refund (ako je online plaćanje)
  stripe_refund_id TEXT,
  refund_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (refund_status IN (
      'pending', 'tse_signed', 'refunded', 'failed'
    )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_storno_original_order
  ON storno_records (original_order_id);

CREATE INDEX idx_storno_org_location
  ON storno_records (org_id, location_id);

-- Na orders tabeli: indikator da postoji storno
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS has_storno BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS storno_total NUMERIC(10, 2) NOT NULL DEFAULT 0;

-- RLS: samo staff iste organizacije može vidjeti storno_records
ALTER TABLE storno_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY storno_records_org_read ON storno_records
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id
      FROM staff
      WHERE user_id = auth.uid()
        AND is_active = true
        AND deleted_at IS NULL
    )
  );

CREATE POLICY storno_records_org_insert ON storno_records
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id
      FROM staff
      WHERE user_id = auth.uid()
        AND is_active = true
        AND deleted_at IS NULL
        AND role IN ('owner', 'manager')
    )
  );

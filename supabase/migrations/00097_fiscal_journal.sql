-- ADR-012 FJ-1: Fiscal journal spine (append-only legal record)
-- Rollback: see bottom comment block

CREATE TABLE fiscal_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL UNIQUE REFERENCES locations(id) ON DELETE CASCADE,
  kassen_id TEXT NOT NULL,
  fiskaly_tss_id TEXT NOT NULL,
  fiskaly_client_id TEXT NOT NULL,
  tss_serial TEXT,
  provisioned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decommissioned_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'decommissioned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fiscal_registers_org ON fiscal_registers (org_id);

CREATE TABLE fiscal_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  register_id UUID NOT NULL REFERENCES fiscal_registers(id) ON DELETE RESTRICT,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,

  tx_type TEXT NOT NULL CHECK (tx_type IN ('sale', 'storno', 'abort', 'z_closing')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'signing', 'signed', 'failed', 'skipped')),

  order_id UUID REFERENCES orders(id) ON DELETE RESTRICT,
  storno_of_id UUID REFERENCES fiscal_transactions(id) ON DELETE RESTRICT,

  currency TEXT NOT NULL DEFAULT 'EUR',
  gross_total NUMERIC(12, 2) NOT NULL,
  net_total NUMERIC(12, 2) NOT NULL,
  tax_total NUMERIC(12, 2) NOT NULL,
  payment_method TEXT,
  payment_type TEXT CHECK (payment_type IS NULL OR payment_type IN ('CASH', 'NON_CASH')),

  fiskaly_tx_id TEXT,
  tse_signature TEXT,
  tse_data JSONB,
  signature_counter INTEGER,
  tse_start TIMESTAMPTZ,
  tse_end TIMESTAMPTZ,

  bon_number INTEGER,
  z_nr INTEGER,
  business_date DATE NOT NULL,

  idempotency_key TEXT NOT NULL,
  failure_reason TEXT,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (register_id, idempotency_key),

  CONSTRAINT fiscal_storno_requires_parent CHECK (
    tx_type <> 'storno' OR storno_of_id IS NOT NULL
  ),
  CONSTRAINT fiscal_sale_requires_order CHECK (
    tx_type NOT IN ('sale', 'abort') OR order_id IS NOT NULL
  )
);

CREATE UNIQUE INDEX idx_fiscal_one_signed_sale_per_order
  ON fiscal_transactions (order_id)
  WHERE tx_type = 'sale' AND status = 'signed';

CREATE INDEX idx_fiscal_tx_register_date
  ON fiscal_transactions (register_id, business_date DESC);

CREATE INDEX idx_fiscal_tx_location_date
  ON fiscal_transactions (location_id, business_date DESC);

CREATE INDEX idx_fiscal_tx_storno_of
  ON fiscal_transactions (storno_of_id)
  WHERE storno_of_id IS NOT NULL;

CREATE TABLE fiscal_transaction_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_transaction_id UUID NOT NULL
    REFERENCES fiscal_transactions(id) ON DELETE RESTRICT,
  line_no INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  quantity NUMERIC(10, 3) NOT NULL,
  tax_rate NUMERIC(5, 2) NOT NULL,
  gross NUMERIC(12, 2) NOT NULL,
  net NUMERIC(12, 2) NOT NULL,
  tax NUMERIC(12, 2) NOT NULL,
  UNIQUE (fiscal_transaction_id, line_no)
);

CREATE TABLE fiscal_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_transaction_id UUID NOT NULL UNIQUE
    REFERENCES fiscal_transactions(id) ON DELETE RESTRICT,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('beleg_html', 'z_bon_html')),
  content_hash TEXT NOT NULL,
  payload JSONB NOT NULL,
  public_token UUID UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE fiscal_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  pos_provider TEXT NOT NULL,
  pos_external_id TEXT,
  pos_receipt_ref TEXT,
  handed_off_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

CREATE INDEX idx_fiscal_handoffs_location
  ON fiscal_handoffs (location_id, handed_off_at DESC);

-- Z-Bon read model links to journal source of truth (ADR-012 §8)
ALTER TABLE daily_closings
  ADD COLUMN IF NOT EXISTS fiscal_transaction_id UUID
    REFERENCES fiscal_transactions(id) ON DELETE RESTRICT;

ALTER TABLE daily_closings
  ADD COLUMN IF NOT EXISTS z_nr INTEGER;

-- RLS
ALTER TABLE fiscal_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_transaction_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_handoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY fiscal_registers_org_read ON fiscal_registers
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM staff
      WHERE user_id = auth.uid() AND is_active = true AND deleted_at IS NULL
    )
  );

CREATE POLICY fiscal_transactions_org_read ON fiscal_transactions
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM staff
      WHERE user_id = auth.uid() AND is_active = true AND deleted_at IS NULL
    )
  );

CREATE POLICY fiscal_transaction_lines_org_read ON fiscal_transaction_lines
  FOR SELECT USING (
    fiscal_transaction_id IN (
      SELECT id FROM fiscal_transactions ft
      WHERE ft.org_id IN (
        SELECT org_id FROM staff
        WHERE user_id = auth.uid() AND is_active = true AND deleted_at IS NULL
      )
    )
  );

CREATE POLICY fiscal_artifacts_org_read ON fiscal_artifacts
  FOR SELECT USING (
    fiscal_transaction_id IN (
      SELECT id FROM fiscal_transactions ft
      WHERE ft.org_id IN (
        SELECT org_id FROM staff
        WHERE user_id = auth.uid() AND is_active = true AND deleted_at IS NULL
      )
    )
  );

CREATE POLICY fiscal_handoffs_org_read ON fiscal_handoffs
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM staff
      WHERE user_id = auth.uid() AND is_active = true AND deleted_at IS NULL
    )
  );

COMMENT ON TABLE fiscal_transactions IS
  'ADR-012 append-only fiscal journal. Storno rows MUST reference storno_of_id → original signed sale.';

COMMENT ON TABLE daily_closings IS
  'Denormalized Z-Bon read model; source of truth is fiscal_transactions (tx_type=z_closing).';

-- Rollback:
-- ALTER TABLE daily_closings DROP COLUMN IF EXISTS fiscal_transaction_id;
-- ALTER TABLE daily_closings DROP COLUMN IF EXISTS z_nr;
-- DROP TABLE IF EXISTS fiscal_handoffs, fiscal_artifacts, fiscal_transaction_lines, fiscal_transactions, fiscal_registers;

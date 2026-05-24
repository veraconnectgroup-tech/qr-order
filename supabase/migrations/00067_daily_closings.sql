-- B4: Z-Bon / Tagesabschluss (daily fiscal closing, KassenSichV standalone)

CREATE TABLE daily_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  business_date DATE NOT NULL,
  total_gross DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_net DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_tax DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_cash DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_non_cash DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_tips DECIMAL(12,2) NOT NULL DEFAULT 0,
  vat_summary JSONB NOT NULL DEFAULT '[]',
  order_count INTEGER NOT NULL DEFAULT 0,
  refund_count INTEGER NOT NULL DEFAULT 0,
  refund_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  tse_closing_signature TEXT,
  tse_closing_data JSONB,
  closed_by UUID REFERENCES auth.users(id),
  closed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(location_id, business_date)
);

CREATE INDEX idx_daily_closings_org_date
  ON daily_closings(org_id, business_date DESC);

CREATE INDEX idx_daily_closings_loc_date
  ON daily_closings(location_id, business_date DESC);

ALTER TABLE daily_closings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view own org closings"
  ON daily_closings FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM staff
      WHERE user_id = auth.uid()
        AND deleted_at IS NULL
    )
  );

COMMENT ON TABLE daily_closings IS
  'Daily Z-Bon / Tagesabschluss per location (KassenSichV standalone mode).';

-- H6: Stripe Terminal — reader registry + card_terminal payment method

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS stripe_terminal_location_id TEXT;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN (
    'unset', 'online', 'at_bar', 'card_at_table', 'card_terminal', 'pos', 'pos_online'
  ));

CREATE TABLE IF NOT EXISTS terminal_readers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_reader_id TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'Reader',
  status TEXT NOT NULL DEFAULT 'offline'
    CHECK (status IN ('online', 'offline')),
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, stripe_reader_id)
);

CREATE INDEX IF NOT EXISTS idx_terminal_readers_location
  ON terminal_readers (location_id);

CREATE INDEX IF NOT EXISTS idx_terminal_readers_org
  ON terminal_readers (org_id);

ALTER TABLE terminal_readers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_select_terminal_readers" ON terminal_readers;
CREATE POLICY "staff_select_terminal_readers" ON terminal_readers
  FOR SELECT
  USING (org_id IN (SELECT org_id FROM staff WHERE user_id = auth.uid() AND is_active = true));

DROP POLICY IF EXISTS "admin_insert_terminal_readers" ON terminal_readers;
CREATE POLICY "admin_insert_terminal_readers" ON terminal_readers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.user_id = auth.uid()
        AND s.org_id = terminal_readers.org_id
        AND s.role IN ('owner', 'manager')
        AND s.is_active = true
    )
  );

DROP POLICY IF EXISTS "admin_update_terminal_readers" ON terminal_readers;
CREATE POLICY "admin_update_terminal_readers" ON terminal_readers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.user_id = auth.uid()
        AND s.org_id = terminal_readers.org_id
        AND s.role IN ('owner', 'manager')
        AND s.is_active = true
    )
  );

DROP POLICY IF EXISTS "admin_delete_terminal_readers" ON terminal_readers;
CREATE POLICY "admin_delete_terminal_readers" ON terminal_readers
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.user_id = auth.uid()
        AND s.org_id = terminal_readers.org_id
        AND s.role IN ('owner', 'manager')
        AND s.is_active = true
    )
  );

DROP TRIGGER IF EXISTS trg_terminal_readers_updated_at ON terminal_readers;
CREATE TRIGGER trg_terminal_readers_updated_at
  BEFORE UPDATE ON terminal_readers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE terminal_readers IS
  'Stripe Terminal readers registered per location (Track H6).';

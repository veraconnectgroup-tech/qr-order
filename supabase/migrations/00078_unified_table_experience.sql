-- H1: Unified Table Experience — schema for POS inbound idempotency and table mapping.
-- Track H, phase H1 only. Rollback: drop policies/tables/constraints in reverse order.

-- ===== orders.order_source: add 'pos' =====
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_source_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_order_source_check
  CHECK (order_source IN ('qr', 'staff', 'kiosk', 'pos'));

-- ===== orders.payment_status: add 'pos_online' =====
-- Marks orders paid online via Vera for a POS-originated session line (Track H).
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN (
    'pending', 'processing', 'paid', 'refunded', 'partial_refund', 'failed', 'pos_online'
  ));

-- ===== pos_order_links: inbound idempotency (integration + external order id) =====
CREATE TABLE IF NOT EXISTS pos_order_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_integration_id UUID NOT NULL REFERENCES pos_integrations(id) ON DELETE CASCADE,
  external_order_id TEXT NOT NULL,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pos_integration_id, external_order_id)
);

CREATE INDEX IF NOT EXISTS idx_pos_order_links_order
  ON pos_order_links (order_id);

CREATE INDEX IF NOT EXISTS idx_pos_order_links_integration
  ON pos_order_links (pos_integration_id);

-- ===== pos_table_mappings: POS table key → Vera table_id =====
CREATE TABLE IF NOT EXISTS pos_table_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN (
    'deliverect', 'orderbird', 'lightspeed', 'ready2order', 'custom'
  )),
  external_table_key TEXT NOT NULL,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, provider, external_table_key)
);

CREATE INDEX IF NOT EXISTS idx_pos_table_mappings_table
  ON pos_table_mappings (table_id);

CREATE INDEX IF NOT EXISTS idx_pos_table_mappings_location
  ON pos_table_mappings (location_id, provider);

-- ===== RLS =====
ALTER TABLE pos_order_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_table_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_select_pos_order_links" ON pos_order_links
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM pos_integrations pi
      WHERE pi.id = pos_order_links.pos_integration_id
        AND pi.location_id = ANY(get_user_location_ids())
    )
  );

CREATE POLICY "staff_select_pos_table_mappings" ON pos_table_mappings
  FOR SELECT
  USING (location_id = ANY(get_user_location_ids()));

CREATE POLICY "admin_insert_pos_table_mappings" ON pos_table_mappings
  FOR INSERT
  WITH CHECK (
    location_id = ANY(get_user_location_ids())
    AND EXISTS (
      SELECT 1
      FROM staff s
      JOIN locations l ON l.id = pos_table_mappings.location_id
      WHERE s.user_id = auth.uid()
        AND s.is_active = true
        AND s.deleted_at IS NULL
        AND s.org_id = l.org_id
        AND s.role IN ('owner', 'manager')
        AND (s.location_id IS NULL OR s.location_id = pos_table_mappings.location_id)
    )
  );

CREATE POLICY "admin_update_pos_table_mappings" ON pos_table_mappings
  FOR UPDATE
  USING (
    location_id = ANY(get_user_location_ids())
    AND EXISTS (
      SELECT 1
      FROM staff s
      JOIN locations l ON l.id = pos_table_mappings.location_id
      WHERE s.user_id = auth.uid()
        AND s.is_active = true
        AND s.deleted_at IS NULL
        AND s.org_id = l.org_id
        AND s.role IN ('owner', 'manager')
        AND (s.location_id IS NULL OR s.location_id = pos_table_mappings.location_id)
    )
  )
  WITH CHECK (
    location_id = ANY(get_user_location_ids())
    AND EXISTS (
      SELECT 1
      FROM staff s
      JOIN locations l ON l.id = pos_table_mappings.location_id
      WHERE s.user_id = auth.uid()
        AND s.is_active = true
        AND s.deleted_at IS NULL
        AND s.org_id = l.org_id
        AND s.role IN ('owner', 'manager')
        AND (s.location_id IS NULL OR s.location_id = pos_table_mappings.location_id)
    )
  );

CREATE POLICY "admin_delete_pos_table_mappings" ON pos_table_mappings
  FOR DELETE
  USING (
    location_id = ANY(get_user_location_ids())
    AND EXISTS (
      SELECT 1
      FROM staff s
      JOIN locations l ON l.id = pos_table_mappings.location_id
      WHERE s.user_id = auth.uid()
        AND s.is_active = true
        AND s.deleted_at IS NULL
        AND s.org_id = l.org_id
        AND s.role IN ('owner', 'manager')
        AND (s.location_id IS NULL OR s.location_id = pos_table_mappings.location_id)
    )
  );

CREATE TRIGGER trg_pos_table_mappings_updated_at
  BEFORE UPDATE ON pos_table_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE pos_order_links IS
  'Idempotency for POS inbound orders: one Vera order per (integration, external_order_id).';
COMMENT ON TABLE pos_table_mappings IS
  'Maps POS table identifier to Vera tables.id per location and provider.';

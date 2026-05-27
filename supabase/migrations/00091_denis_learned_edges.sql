-- M16: Denis learned VKG edge queue (L3 — admin approve before apply)

CREATE TABLE IF NOT EXISTS denis_learned_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL DEFAULT 'pairs_with'
    CHECK (edge_type IN ('pairs_with', 'upsell_after')),
  from_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  to_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  impressions INT NOT NULL DEFAULT 0 CHECK (impressions >= 0),
  accepts INT NOT NULL DEFAULT 0 CHECK (accepts >= 0),
  accept_rate DECIMAL(6, 4) NOT NULL DEFAULT 0 CHECK (accept_rate >= 0 AND accept_rate <= 1),
  suggested_weight DECIMAL(6, 4) NOT NULL DEFAULT 0.5
    CHECK (suggested_weight >= 0 AND suggested_weight <= 1),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  source TEXT NOT NULL DEFAULT 'aggregate'
    CHECK (source IN ('aggregate', 'manual')),
  reviewed_at TIMESTAMPTZ,
  reviewed_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  upsell_rule_id UUID REFERENCES upsell_rules(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, edge_type, from_product_id, to_product_id)
);

CREATE INDEX IF NOT EXISTS idx_denis_learned_edges_location_status
  ON denis_learned_edges (location_id, status, accept_rate DESC);

ALTER TABLE denis_learned_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_denis_learned_edges" ON denis_learned_edges
  FOR ALL
  USING (location_id = ANY(get_user_location_ids()))
  WITH CHECK (location_id = ANY(get_user_location_ids()));

COMMENT ON TABLE denis_learned_edges IS
  'L3 learned pairing candidates — pending until admin approves (ADR-005 §7.1)';

-- Upsell / cross-sell rules per location
CREATE TABLE IF NOT EXISTS upsell_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  trigger_product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  trigger_category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  suggest_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  message TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (trigger_product_id IS NOT NULL OR trigger_category_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_upsell_rules_location
  ON upsell_rules (location_id, is_active, sort_order);

ALTER TABLE upsell_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_upsells" ON upsell_rules
  FOR ALL
  USING (location_id = ANY(get_user_location_ids()))
  WITH CHECK (location_id = ANY(get_user_location_ids()));

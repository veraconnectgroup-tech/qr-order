-- Prompt 75: Upsell rules engine — extended rule types, A/B variants, success tracking

ALTER TABLE upsell_rules
  ADD COLUMN IF NOT EXISTS rule_type TEXT,
  ADD COLUMN IF NOT EXISTS conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ab_variants JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS impressions_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conversions_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS declines_count INTEGER NOT NULL DEFAULT 0;

UPDATE upsell_rules
SET rule_type = CASE
  WHEN trigger_category_id IS NOT NULL THEN 'category_product'
  ELSE 'product_product'
END
WHERE rule_type IS NULL;

ALTER TABLE upsell_rules
  ALTER COLUMN rule_type SET DEFAULT 'product_product',
  ALTER COLUMN rule_type SET NOT NULL;

ALTER TABLE upsell_rules DROP CONSTRAINT IF EXISTS upsell_rules_check;

ALTER TABLE upsell_rules ADD CONSTRAINT upsell_rules_rule_type_check CHECK (
  rule_type IN (
    'product_product',
    'category_product',
    'time_based',
    'cart_value',
    'guest_level'
  )
);

ALTER TABLE upsell_rules ADD CONSTRAINT upsell_rules_trigger_check CHECK (
  (
    rule_type IN ('product_product', 'category_product')
    AND (trigger_product_id IS NOT NULL OR trigger_category_id IS NOT NULL)
  )
  OR rule_type IN ('time_based', 'cart_value', 'guest_level')
);

COMMENT ON COLUMN upsell_rules.rule_type IS
  'Upsell trigger: product_product, category_product, time_based, cart_value, guest_level';
COMMENT ON COLUMN upsell_rules.conditions IS
  'JSON: afterHour, minCartEuros, guestTags, etc.';
COMMENT ON COLUMN upsell_rules.ab_variants IS
  'JSON array: { id, message, weight, impressions, conversions }';

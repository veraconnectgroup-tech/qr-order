-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiter_calls ENABLE ROW LEVEL SECURITY;

-- Helper function: Get user's org IDs
CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS UUID[] AS $$
  SELECT ARRAY(
    SELECT org_id FROM staff WHERE user_id = auth.uid() AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: Get user's location IDs
CREATE OR REPLACE FUNCTION get_user_location_ids()
RETURNS UUID[] AS $$
  SELECT ARRAY(
    SELECT COALESCE(s.location_id, l.id)
    FROM staff s
    LEFT JOIN locations l ON l.org_id = s.org_id
    WHERE s.user_id = auth.uid() AND s.is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ===== GUEST POLICIES (anonymous read for menu data) =====
CREATE POLICY "public_read_organizations" ON organizations
  FOR SELECT USING (true);

CREATE POLICY "public_read_locations" ON locations
  FOR SELECT USING (is_active = true);

CREATE POLICY "public_read_zones" ON zones
  FOR SELECT USING (is_active = true);

CREATE POLICY "public_read_tables" ON tables
  FOR SELECT USING (is_active = true);

CREATE POLICY "public_read_categories" ON categories
  FOR SELECT USING (is_active = true);

CREATE POLICY "public_read_products" ON products
  FOR SELECT USING (true);

CREATE POLICY "public_read_modifier_groups" ON modifier_groups
  FOR SELECT USING (true);

CREATE POLICY "public_read_modifiers" ON modifiers
  FOR SELECT USING (true);

-- ===== STAFF POLICIES =====
CREATE POLICY "staff_read_org" ON organizations
  FOR ALL USING (id = ANY(get_user_org_ids()));

CREATE POLICY "staff_manage_locations" ON locations
  FOR ALL USING (org_id = ANY(get_user_org_ids()));

CREATE POLICY "staff_manage_zones" ON zones
  FOR ALL USING (location_id = ANY(get_user_location_ids()));

CREATE POLICY "staff_manage_tables" ON tables
  FOR ALL USING (location_id = ANY(get_user_location_ids()));

CREATE POLICY "staff_manage_categories" ON categories
  FOR ALL USING (location_id = ANY(get_user_location_ids()));

CREATE POLICY "staff_manage_products" ON products
  FOR ALL USING (location_id = ANY(get_user_location_ids()));

CREATE POLICY "staff_manage_modifier_groups" ON modifier_groups
  FOR ALL USING (
    product_id IN (SELECT id FROM products WHERE location_id = ANY(get_user_location_ids()))
  );

CREATE POLICY "staff_manage_modifiers" ON modifiers
  FOR ALL USING (
    group_id IN (
      SELECT mg.id FROM modifier_groups mg
      JOIN products p ON mg.product_id = p.id
      WHERE p.location_id = ANY(get_user_location_ids())
    )
  );

CREATE POLICY "staff_manage_orders" ON orders
  FOR ALL USING (location_id = ANY(get_user_location_ids()));

CREATE POLICY "staff_read_order_items" ON order_items
  FOR SELECT USING (
    order_id IN (SELECT id FROM orders WHERE location_id = ANY(get_user_location_ids()))
  );

CREATE POLICY "staff_read_order_item_modifiers" ON order_item_modifiers
  FOR SELECT USING (
    order_item_id IN (
      SELECT oi.id FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.location_id = ANY(get_user_location_ids())
    )
  );

CREATE POLICY "staff_manage_sessions" ON table_sessions
  FOR ALL USING (location_id = ANY(get_user_location_ids()));

CREATE POLICY "staff_manage_waiter_calls" ON waiter_calls
  FOR ALL USING (location_id = ANY(get_user_location_ids()));

CREATE POLICY "staff_read_staff" ON staff
  FOR SELECT USING (org_id = ANY(get_user_org_ids()));

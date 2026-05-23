-- QR Order — full cloud setup (schema + RLS + realtime + seed)
-- Run this entire file in Supabase SQL Editor on a fresh project.

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===== ORGANIZATIONS =====
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  cover_image_url TEXT,
  description TEXT,
  stripe_account_id TEXT,
  stripe_onboarded BOOLEAN DEFAULT false,
  platform_fee_percent DECIMAL(4,2) DEFAULT 2.00,
  currency TEXT DEFAULT 'EUR',
  default_tax_percent DECIMAL(4,2) DEFAULT 19.00,
  email TEXT,
  phone TEXT,
  website TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== LOCATIONS =====
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'DE',
  timezone TEXT DEFAULT 'Europe/Berlin',
  operating_hours JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  accepting_orders BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== ZONES =====
CREATE TABLE zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- ===== TABLES =====
CREATE TABLE tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  qr_token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  seats INT DEFAULT 4,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ===== MENU CATEGORIES =====
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  image_url TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  available_from TIME,
  available_until TIME,
  available_days INT[] DEFAULT '{0,1,2,3,4,5,6}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ===== PRODUCTS =====
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  description_en TEXT,
  price DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  prep_time_minutes INT,
  allergens TEXT[],
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== MODIFIER GROUPS =====
CREATE TABLE modifier_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_en TEXT,
  min_select INT DEFAULT 0,
  max_select INT DEFAULT 1,
  is_required BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0
);

-- ===== MODIFIERS =====
CREATE TABLE modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_en TEXT,
  price DECIMAL(10,2) DEFAULT 0,
  is_available BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0
);

-- ===== TABLE SESSIONS =====
CREATE TABLE table_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  guest_email TEXT
);

-- ===== ORDERS =====
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  table_id UUID REFERENCES tables(id),
  session_id UUID REFERENCES table_sessions(id),
  order_number INT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'accepted', 'preparing', 'ready', 'delivered', 'rejected', 'cancelled'
  )),
  subtotal DECIMAL(10,2) NOT NULL,
  tax_percent DECIMAL(4,2) NOT NULL,
  tax_amount DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  stripe_payment_intent_id TEXT,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN (
    'pending', 'processing', 'paid', 'refunded', 'partial_refund', 'failed'
  )),
  notes TEXT,
  rejection_reason TEXT,
  estimated_prep_minutes INT,
  accepted_at TIMESTAMPTZ,
  preparing_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== ORDER ITEMS =====
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  notes TEXT,
  total DECIMAL(10,2) NOT NULL
);

-- ===== ORDER ITEM MODIFIERS =====
CREATE TABLE order_item_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  modifier_id UUID REFERENCES modifiers(id) ON DELETE SET NULL,
  modifier_name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0
);

-- ===== STAFF =====
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id),
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'staff', 'kitchen')),
  name TEXT NOT NULL,
  email TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, org_id)
);

-- ===== WAITER CALLS =====
CREATE TABLE waiter_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  session_id UUID REFERENCES table_sessions(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

-- ===== DAILY ORDER COUNTER =====
CREATE TABLE daily_order_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  last_number INT DEFAULT 0,
  UNIQUE(location_id, date)
);

-- ===== FUNCTION: Get Next Order Number =====
CREATE OR REPLACE FUNCTION get_next_order_number(p_location_id UUID)
RETURNS INT AS $$
DECLARE
  v_number INT;
BEGIN
  INSERT INTO daily_order_counters (location_id, date, last_number)
  VALUES (p_location_id, CURRENT_DATE, 1)
  ON CONFLICT (location_id, date)
  DO UPDATE SET last_number = daily_order_counters.last_number + 1
  RETURNING last_number INTO v_number;

  RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- ===== FUNCTION: Auto-update updated_at =====
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_locations_updated_at
  BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===== INDEXES =====
CREATE INDEX idx_locations_org ON locations(org_id);
CREATE INDEX idx_zones_location ON zones(location_id);
CREATE INDEX idx_tables_location ON tables(location_id);
CREATE INDEX idx_tables_qr_token ON tables(qr_token);
CREATE INDEX idx_categories_location ON categories(location_id, sort_order);
CREATE INDEX idx_products_location ON products(location_id);
CREATE INDEX idx_products_category ON products(category_id, sort_order);
CREATE INDEX idx_modifier_groups_product ON modifier_groups(product_id);
CREATE INDEX idx_modifiers_group ON modifiers(group_id);
CREATE INDEX idx_table_sessions_table ON table_sessions(table_id, status);
CREATE INDEX idx_table_sessions_token ON table_sessions(session_token);
CREATE INDEX idx_orders_location_status ON orders(location_id, status);
CREATE INDEX idx_orders_session ON orders(session_id);
CREATE INDEX idx_orders_table ON orders(table_id);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_payment ON orders(stripe_payment_intent_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_item_modifiers_item ON order_item_modifiers(order_item_id);
CREATE INDEX idx_staff_user ON staff(user_id);
CREATE INDEX idx_staff_org ON staff(org_id);
CREATE INDEX idx_waiter_calls_location_status ON waiter_calls(location_id, status);

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
  FOR SELECT USING (true);

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

-- Enable realtime for orders and waiter_calls (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'waiter_calls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE waiter_calls;
  END IF;
END $$;

-- Demo restaurant: Skyline Lounge

INSERT INTO organizations (id, name, slug, description, email, currency, default_tax_percent)
VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'Skyline Lounge',
  'skyline-lounge',
  'Premium rooftop bar with panoramic city views',
  'hello@skylinelounge.de',
  'EUR',
  19.00
);

INSERT INTO locations (id, org_id, name, address, city, postal_code, country, timezone)
VALUES (
  'b0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  'Skyline Lounge Hamburg',
  'Speicherstadt 1',
  'Hamburg',
  '20457',
  'DE',
  'Europe/Berlin'
);

INSERT INTO zones (id, location_id, name, sort_order) VALUES
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Rooftop', 0),
  ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'Indoor Bar', 1),
  ('c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'VIP Lounge', 2);

INSERT INTO tables (id, location_id, zone_id, name, qr_token, seats) VALUES
  ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Table 1', 'demo-table-1', 4),
  ('d0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Table 2', 'demo-table-2', 4),
  ('d0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Table 3', 'demo-table-3', 6),
  ('d0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Table 4', 'demo-table-4', 2),
  ('d0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'Bar 1', 'demo-bar-1', 2),
  ('d0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'Bar 2', 'demo-bar-2', 2),
  ('d0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'Bar 3', 'demo-bar-3', 2),
  ('d0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 'VIP 1', 'demo-vip-1', 6),
  ('d0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 'VIP 2', 'demo-vip-2', 8),
  ('d0000000-0000-4000-8000-000000000010', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 'VIP 3', 'demo-vip-3', 4),
  ('d0000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Terrace 5', 'demo-terrace-5', 4),
  ('d0000000-0000-4000-8000-000000000012', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Table 8', 'demo-table-8', 4);

INSERT INTO categories (id, location_id, name, name_en, sort_order) VALUES
  ('e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Cocktails', 'Cocktails', 0),
  ('e0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'Spirits', 'Spirits', 1),
  ('e0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'Wine', 'Wine', 2),
  ('e0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'Beer', 'Beer', 3),
  ('e0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', 'Non-Alcoholic', 'Non-Alcoholic', 4),
  ('e0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001', 'Snacks', 'Snacks', 5);

INSERT INTO products (id, location_id, category_id, name, description, price, prep_time_minutes, tags, sort_order) VALUES
  ('f0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'Aperol Spritz', 'Aperol, Prosecco, soda, orange slice', 9.50, 5, ARRAY['popular'], 0),
  ('f0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'Negroni', 'Gin, Campari, sweet vermouth', 12.00, 5, ARRAY['classic'], 1),
  ('f0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'Espresso Martini', 'Vodka, Kahlua, fresh espresso', 13.00, 6, ARRAY['popular'], 2),
  ('f0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'Hugo Spritz', 'Elderflower, Prosecco, mint, lime', 10.00, 5, NULL, 3),
  ('f0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'Mojito', 'White rum, lime, mint, sugar, soda', 11.00, 6, NULL, 4),
  ('f0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'Old Fashioned', 'Bourbon, bitters, sugar, orange peel', 14.00, 5, ARRAY['classic'], 5),
  ('f0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002', 'Gin & Tonic', 'Premium gin, tonic, cucumber', 10.50, 3, NULL, 0),
  ('f0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002', 'Whiskey Sour', 'Bourbon, lemon, simple syrup', 12.50, 5, NULL, 1),
  ('f0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 'Prosecco DOC', 'Glass of Italian Prosecco', 7.50, 2, NULL, 0),
  ('f0000000-0000-4000-8000-000000000010', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 'Pinot Grigio', 'Crisp white wine from Veneto', 8.50, 2, NULL, 1),
  ('f0000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 'Malbec Reserva', 'Full-bodied red from Mendoza', 9.50, 2, NULL, 2),
  ('f0000000-0000-4000-8000-000000000012', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000004', 'Craft IPA', 'Local brewery, hoppy and citrusy', 5.50, 2, NULL, 0),
  ('f0000000-0000-4000-8000-000000000013', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000004', 'Pilsner', 'Classic German pilsner on tap', 4.50, 2, NULL, 1),
  ('f0000000-0000-4000-8000-000000000014', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000004', 'Radler', 'Beer mixed with lemonade', 4.00, 2, NULL, 2),
  ('f0000000-0000-4000-8000-000000000015', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000005', 'Fresh Lemonade', 'Homemade with mint', 4.50, 3, ARRAY['vegan'], 0),
  ('f0000000-0000-4000-8000-000000000016', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000005', 'Sparkling Water', '500ml San Pellegrino', 3.50, 1, NULL, 1),
  ('f0000000-0000-4000-8000-000000000017', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000005', 'Cola', 'Classic cola with ice', 3.50, 1, NULL, 2),
  ('f0000000-0000-4000-8000-000000000018', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000005', 'Espresso', 'Double shot', 3.00, 3, NULL, 3),
  ('f0000000-0000-4000-8000-000000000019', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000006', 'Truffle Fries', 'Parmesan, truffle oil, herbs', 8.50, 10, ARRAY['popular'], 0),
  ('f0000000-0000-4000-8000-000000000020', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000006', 'Nachos Supreme', 'Cheese, jalapeños, guacamole, sour cream', 9.00, 8, NULL, 1),
  ('f0000000-0000-4000-8000-000000000021', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000006', 'Charcuterie Board', 'Selection of cured meats and cheeses', 16.00, 5, NULL, 2),
  ('f0000000-0000-4000-8000-000000000022', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000006', 'Bruschetta Trio', 'Tomato, olive tapenade, ricotta', 7.50, 7, ARRAY['vegetarian'], 3);

-- Modifier groups for Espresso Martini
INSERT INTO modifier_groups (id, product_id, name, min_select, max_select, is_required, sort_order) VALUES
  ('ab000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000003', 'Size', 1, 1, true, 0),
  ('ab000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000003', 'Extras', 0, 3, false, 1);

INSERT INTO modifiers (group_id, name, price, sort_order) VALUES
  ('ab000000-0000-4000-8000-000000000001', 'Regular', 0, 0),
  ('ab000000-0000-4000-8000-000000000001', 'Large', 2.00, 1),
  ('ab000000-0000-4000-8000-000000000002', 'Extra Shot', 1.50, 0),
  ('ab000000-0000-4000-8000-000000000002', 'Vanilla Syrup', 0.50, 1),
  ('ab000000-0000-4000-8000-000000000002', 'Oat Milk', 0.80, 2);

-- Modifier group for Gin & Tonic
INSERT INTO modifier_groups (id, product_id, name, min_select, max_select, is_required, sort_order) VALUES
  ('ab000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000007', 'Ice', 1, 1, true, 0);

INSERT INTO modifiers (group_id, name, price, sort_order) VALUES
  ('ab000000-0000-4000-8000-000000000003', 'Regular Ice', 0, 0),
  ('ab000000-0000-4000-8000-000000000003', 'Less Ice', 0, 1),
  ('ab000000-0000-4000-8000-000000000003', 'No Ice', 0, 2);

-- ===== SECURITY: Refund tracking + audit log =====
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_by UUID REFERENCES staff(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  amount DECIMAL(10,2),
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read own org audit log" ON audit_log
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM orders WHERE location_id = ANY(get_user_location_ids())
    )
    OR staff_id IN (
      SELECT id FROM staff WHERE org_id = ANY(get_user_org_ids())
    )
  );

-- Demo product photos + allergens (see src/lib/product-stock-images.ts)
UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1758218058958-78f40a716c20?w=600&q=80',
  allergens = ARRAY['sulfites']
WHERE id = 'f0000000-0000-4000-8000-000000000001';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=600&q=80',
  allergens = ARRAY['sulfites']
WHERE id = 'f0000000-0000-4000-8000-000000000002';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=600&q=80',
  allergens = ARRAY['sulfites']
WHERE id = 'f0000000-0000-4000-8000-000000000003';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&q=80',
  allergens = ARRAY['sulfites']
WHERE id = 'f0000000-0000-4000-8000-000000000004';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=600&q=80',
  allergens = ARRAY['sulfites']
WHERE id = 'f0000000-0000-4000-8000-000000000005';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=600&q=80',
  allergens = ARRAY['sulfites']
WHERE id = 'f0000000-0000-4000-8000-000000000006';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&q=80',
  allergens = ARRAY['sulfites']
WHERE id = 'f0000000-0000-4000-8000-000000000007';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=600&q=80',
  allergens = ARRAY['sulfites']
WHERE id = 'f0000000-0000-4000-8000-000000000008';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=600&q=80',
  allergens = ARRAY['sulfites']
WHERE id = 'f0000000-0000-4000-8000-000000000009';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1547595628-c61a29f496f0?w=600&q=80',
  allergens = ARRAY['sulfites']
WHERE id = 'f0000000-0000-4000-8000-000000000010';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=600&q=80',
  allergens = ARRAY['sulfites']
WHERE id = 'f0000000-0000-4000-8000-000000000011';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1436076863939-06870fe779c2?w=600&q=80',
  allergens = ARRAY['gluten']
WHERE id = 'f0000000-0000-4000-8000-000000000012';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=600&q=80',
  allergens = ARRAY['gluten']
WHERE id = 'f0000000-0000-4000-8000-000000000013';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=600&q=80',
  allergens = ARRAY['gluten']
WHERE id = 'f0000000-0000-4000-8000-000000000014';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=600&q=80'
WHERE id = 'f0000000-0000-4000-8000-000000000015';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&q=80'
WHERE id = 'f0000000-0000-4000-8000-000000000016';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=600&q=80'
WHERE id = 'f0000000-0000-4000-8000-000000000017';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&q=80'
WHERE id = 'f0000000-0000-4000-8000-000000000018';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=600&q=80',
  allergens = ARRAY['gluten', 'dairy']
WHERE id = 'f0000000-0000-4000-8000-000000000019';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=80',
  allergens = ARRAY['gluten', 'dairy']
WHERE id = 'f0000000-0000-4000-8000-000000000020';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80',
  allergens = ARRAY['dairy']
WHERE id = 'f0000000-0000-4000-8000-000000000021';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=600&q=80',
  allergens = ARRAY['gluten', 'dairy']
WHERE id = 'f0000000-0000-4000-8000-000000000022';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600&q=80',
  allergens = ARRAY['gluten', 'dairy', 'eggs']
WHERE id = 'f0000000-0000-4000-8000-000000000023';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=600&q=80',
  allergens = ARRAY['gluten', 'dairy', 'eggs']
WHERE id = 'f0000000-0000-4000-8000-000000000024';

UPDATE products SET
  image_url = 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&q=80',
  allergens = ARRAY['gluten', 'dairy', 'eggs']
WHERE id = 'f0000000-0000-4000-8000-000000000025';

-- ===== PRODUCT IMAGE STORAGE =====
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Public read product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Staff upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1]::uuid = ANY(get_user_org_ids())
);

CREATE POLICY "Staff update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1]::uuid = ANY(get_user_org_ids())
);

CREATE POLICY "Staff delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1]::uuid = ANY(get_user_org_ids())
);

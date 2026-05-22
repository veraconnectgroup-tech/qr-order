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

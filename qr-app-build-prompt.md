# QR ORDER — FULL APP BUILD PROMPT (for Cursor)

> Build the complete functional app — not landing page mockups, but real working screens with real data, real payments, real-time updates. Follow this prompt step by step.

> **This repo:** Run Step 0 manually in the [Supabase SQL Editor](https://supabase.com/dashboard) using **`supabase/cloud-setup.sql`** (schema + RLS + Skyline Lounge seed). The SQL block below is the original spec; `cloud-setup.sql` is the source of truth for this codebase.

---

## STEP 0: SUPABASE SETUP

Before writing any app code, set up the Supabase project. Run **`supabase/cloud-setup.sql`** in the Supabase SQL Editor (or the SQL below for a fresh project):

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ORGANIZATIONS (restaurant/bar owners)
-- ============================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL, -- URL-friendly: "skyline-lounge"
  logo_url TEXT,
  stripe_account_id TEXT, -- Stripe Connect account
  stripe_onboarding_complete BOOLEAN DEFAULT FALSE,
  settings JSONB DEFAULT '{}', -- currency, timezone, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- LOCATIONS (physical venues)
-- ============================================
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- "Rooftop", "Main Floor"
  address TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ZONES (areas within a location)
-- ============================================
CREATE TABLE zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- "Rooftop", "VIP Lounge", "Bar Area"
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLES
-- ============================================
CREATE TABLE tables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  zone_id UUID REFERENCES zones(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- "Table 1", "VIP 2", "Bar 3"
  qr_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex'), -- random token for QR URL
  seats INT DEFAULT 4,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CATEGORIES
-- ============================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- "Cocktails"
  name_en TEXT, -- optional English translation
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PRODUCTS
-- ============================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  description_en TEXT,
  price DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  is_available BOOLEAN DEFAULT TRUE,
  prep_time_minutes INT DEFAULT 5,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MODIFIER GROUPS (Size, Extras, etc.)
-- ============================================
CREATE TABLE modifier_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- "Size", "Extras"
  is_required BOOLEAN DEFAULT FALSE,
  max_select INT DEFAULT 1, -- 1 = radio, >1 = checkbox
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MODIFIERS (individual options)
-- ============================================
CREATE TABLE modifiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  modifier_group_id UUID REFERENCES modifier_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- "Large", "Extra Shot"
  price DECIMAL(10,2) DEFAULT 0, -- additional price
  is_available BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE SESSIONS (groups orders per guest visit)
-- ============================================
CREATE TABLE table_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id UUID REFERENCES tables(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  guest_identifier TEXT, -- anonymous session ID from browser
  started_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- ============================================
-- DAILY ORDER COUNTER (for sequential order numbers)
-- ============================================
CREATE TABLE daily_order_counters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  counter INT DEFAULT 0,
  UNIQUE(organization_id, date)
);

-- ============================================
-- ORDERS
-- ============================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  table_session_id UUID REFERENCES table_sessions(id),
  table_id UUID REFERENCES tables(id),
  order_number INT NOT NULL, -- daily sequential: 1, 2, 3...
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'preparing', 'ready', 'delivered', 'rejected')),
  subtotal DECIMAL(10,2) NOT NULL,
  tax DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  stripe_payment_intent_id TEXT,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'failed')),
  rejection_reason TEXT,
  guest_email TEXT, -- optional, for receipt
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ORDER ITEMS
-- ============================================
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL, -- snapshot at order time
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL, -- snapshot at order time
  total_price DECIMAL(10,2) NOT NULL, -- (unit_price + modifiers) * quantity
  special_instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ORDER ITEM MODIFIERS
-- ============================================
CREATE TABLE order_item_modifiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
  modifier_name TEXT NOT NULL, -- snapshot
  modifier_price DECIMAL(10,2) NOT NULL, -- snapshot
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STAFF
-- ============================================
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  email TEXT NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'staff' CHECK (role IN ('owner', 'manager', 'staff', 'kitchen')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- WAITER CALLS
-- ============================================
CREATE TABLE waiter_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id UUID REFERENCES tables(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  table_session_id UUID REFERENCES table_sessions(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-increment daily order number
CREATE OR REPLACE FUNCTION get_next_order_number(org_id UUID)
RETURNS INT AS $$
DECLARE
  next_num INT;
BEGIN
  INSERT INTO daily_order_counters (organization_id, date, counter)
  VALUES (org_id, CURRENT_DATE, 1)
  ON CONFLICT (organization_id, date)
  DO UPDATE SET counter = daily_order_counters.counter + 1
  RETURNING counter INTO next_num;
  RETURN next_num;
END;
$$ LANGUAGE plpgsql;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiter_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_order_counters ENABLE ROW LEVEL SECURITY;

-- Public read for guest-facing data (menu, tables via QR token)
CREATE POLICY "Public can read active products" ON products FOR SELECT USING (is_available = TRUE);
CREATE POLICY "Public can read active categories" ON categories FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Public can read modifier groups" ON modifier_groups FOR SELECT USING (TRUE);
CREATE POLICY "Public can read modifiers" ON modifiers FOR SELECT USING (is_available = TRUE);
CREATE POLICY "Public can read tables by token" ON tables FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Public can read organizations" ON organizations FOR SELECT USING (TRUE);
CREATE POLICY "Public can read zones" ON zones FOR SELECT USING (TRUE);
CREATE POLICY "Public can read locations" ON locations FOR SELECT USING (is_active = TRUE);

-- Public can create orders and sessions (guests don't have accounts)
CREATE POLICY "Public can create table sessions" ON table_sessions FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Public can read own sessions" ON table_sessions FOR SELECT USING (TRUE);
CREATE POLICY "Public can create orders" ON orders FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Public can read own orders" ON orders FOR SELECT USING (TRUE);
CREATE POLICY "Public can create order items" ON order_items FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Public can read order items" ON order_items FOR SELECT USING (TRUE);
CREATE POLICY "Public can create order item modifiers" ON order_item_modifiers FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Public can read order item modifiers" ON order_item_modifiers FOR SELECT USING (TRUE);
CREATE POLICY "Public can create waiter calls" ON waiter_calls FOR INSERT WITH CHECK (TRUE);

-- Staff can read/write their organization's data
CREATE POLICY "Staff full access to own org orders" ON orders FOR ALL USING (
  organization_id IN (SELECT organization_id FROM staff WHERE user_id = auth.uid())
);
CREATE POLICY "Staff full access to own org waiter calls" ON waiter_calls FOR ALL USING (
  organization_id IN (SELECT organization_id FROM staff WHERE user_id = auth.uid())
);
CREATE POLICY "Staff full access to own org products" ON products FOR ALL USING (
  organization_id IN (SELECT organization_id FROM staff WHERE user_id = auth.uid())
);
CREATE POLICY "Staff full access to own org categories" ON categories FOR ALL USING (
  organization_id IN (SELECT organization_id FROM staff WHERE user_id = auth.uid())
);

-- ============================================
-- SEED DATA (Demo restaurant for development)
-- ============================================
DO $$
DECLARE
  org_id UUID;
  loc_id UUID;
  zone_rooftop UUID;
  zone_vip UUID;
  zone_bar UUID;
  cat_cocktails UUID;
  cat_wine UUID;
  cat_beer UUID;
  cat_food UUID;
  prod_aperol UUID;
  prod_negroni UUID;
  prod_espresso UUID;
  prod_hugo UUID;
BEGIN
  -- Organization
  INSERT INTO organizations (id, name, slug, settings)
  VALUES (uuid_generate_v4(), 'Skyline Lounge', 'skyline-lounge', '{"currency": "EUR", "timezone": "Europe/Berlin", "tax_rate": 19}')
  RETURNING id INTO org_id;

  -- Location
  INSERT INTO locations (id, organization_id, name, address)
  VALUES (uuid_generate_v4(), org_id, 'Rooftop Hamburg', 'Jungfernstieg 1, 20095 Hamburg')
  RETURNING id INTO loc_id;

  -- Zones
  INSERT INTO zones (id, location_id, name, sort_order) VALUES (uuid_generate_v4(), loc_id, 'Rooftop', 1) RETURNING id INTO zone_rooftop;
  INSERT INTO zones (id, location_id, name, sort_order) VALUES (uuid_generate_v4(), loc_id, 'VIP Lounge', 2) RETURNING id INTO zone_vip;
  INSERT INTO zones (id, location_id, name, sort_order) VALUES (uuid_generate_v4(), loc_id, 'Bar Area', 3) RETURNING id INTO zone_bar;

  -- Tables
  INSERT INTO tables (zone_id, name, seats) VALUES
    (zone_rooftop, 'Table 1', 4), (zone_rooftop, 'Table 2', 4),
    (zone_rooftop, 'Table 3', 6), (zone_rooftop, 'Table 4', 2),
    (zone_rooftop, 'Table 5', 4), (zone_rooftop, 'Table 6', 4),
    (zone_rooftop, 'Table 7', 6), (zone_rooftop, 'Table 8', 4),
    (zone_vip, 'VIP 1', 6), (zone_vip, 'VIP 2', 8), (zone_vip, 'VIP 3', 4),
    (zone_bar, 'Bar 1', 2), (zone_bar, 'Bar 2', 2), (zone_bar, 'Bar 3', 2);

  -- Categories
  INSERT INTO categories (id, organization_id, name, sort_order) VALUES
    (uuid_generate_v4(), org_id, 'Cocktails', 1) RETURNING id INTO cat_cocktails;
  INSERT INTO categories (id, organization_id, name, sort_order) VALUES
    (uuid_generate_v4(), org_id, 'Wine', 2) RETURNING id INTO cat_wine;
  INSERT INTO categories (id, organization_id, name, sort_order) VALUES
    (uuid_generate_v4(), org_id, 'Beer', 3) RETURNING id INTO cat_beer;
  INSERT INTO categories (id, organization_id, name, sort_order) VALUES
    (uuid_generate_v4(), org_id, 'Food', 4) RETURNING id INTO cat_food;

  -- Products: Cocktails
  INSERT INTO products (id, organization_id, category_id, name, description, price, sort_order) VALUES
    (uuid_generate_v4(), org_id, cat_cocktails, 'Aperol Spritz', 'Aperol, Prosecco, Soda, Orange', 9.50, 1) RETURNING id INTO prod_aperol;
  INSERT INTO products (id, organization_id, category_id, name, description, price, sort_order) VALUES
    (uuid_generate_v4(), org_id, cat_cocktails, 'Negroni', 'Gin, Campari, Sweet Vermouth', 12.00, 2) RETURNING id INTO prod_negroni;
  INSERT INTO products (id, organization_id, category_id, name, description, price, sort_order) VALUES
    (uuid_generate_v4(), org_id, cat_cocktails, 'Espresso Martini', 'Vodka, Kahlúa, Fresh Espresso', 13.00, 3) RETURNING id INTO prod_espresso;
  INSERT INTO products (id, organization_id, category_id, name, description, price, sort_order) VALUES
    (uuid_generate_v4(), org_id, cat_cocktails, 'Hugo Spritz', 'Elderflower, Prosecco, Mint, Lime', 10.00, 4) RETURNING id INTO prod_hugo;

  -- Products: Wine
  INSERT INTO products (organization_id, category_id, name, description, price, sort_order) VALUES
    (org_id, cat_wine, 'Sauvignon Blanc', 'New Zealand, crisp & fresh', 8.50, 1),
    (org_id, cat_wine, 'Pinot Grigio', 'Italian, light & dry', 7.50, 2),
    (org_id, cat_wine, 'Merlot', 'French, smooth & rich', 8.00, 3),
    (org_id, cat_wine, 'Rosé', 'Provence, dry & refreshing', 9.00, 4);

  -- Products: Beer
  INSERT INTO products (organization_id, category_id, name, description, price, sort_order) VALUES
    (org_id, cat_beer, 'Pilsner', 'German draft, 0.5L', 5.50, 1),
    (org_id, cat_beer, 'Wheat Beer', 'Bavarian Hefeweizen, 0.5L', 6.00, 2),
    (org_id, cat_beer, 'IPA', 'Craft India Pale Ale, 0.33L', 6.50, 3),
    (org_id, cat_beer, 'Alcohol-Free', 'Pilsner style, 0.5L', 4.50, 4);

  -- Products: Food
  INSERT INTO products (organization_id, category_id, name, description, price, sort_order) VALUES
    (org_id, cat_food, 'Nachos Supreme', 'Tortilla chips, cheese, jalapeños, guacamole, sour cream', 12.50, 1),
    (org_id, cat_food, 'Truffle Fries', 'Hand-cut fries, truffle oil, parmesan, aioli', 9.00, 2),
    (org_id, cat_food, 'Bruschetta', 'Toasted sourdough, tomato, basil, balsamic', 8.50, 3),
    (org_id, cat_food, 'Charcuterie Board', 'Prosciutto, salami, cheeses, olives, crackers', 18.00, 4);

  -- Modifier groups for Espresso Martini
  INSERT INTO modifier_groups (id, product_id, name, is_required, max_select, sort_order) VALUES
    (uuid_generate_v4(), prod_espresso, 'Size', TRUE, 1, 1);
  INSERT INTO modifiers (modifier_group_id, name, price, sort_order) VALUES
    ((SELECT id FROM modifier_groups WHERE product_id = prod_espresso AND name = 'Size'), 'Regular', 0, 1),
    ((SELECT id FROM modifier_groups WHERE product_id = prod_espresso AND name = 'Size'), 'Large', 2.00, 2);

  INSERT INTO modifier_groups (id, product_id, name, is_required, max_select, sort_order) VALUES
    (uuid_generate_v4(), prod_espresso, 'Extras', FALSE, 3, 2);
  INSERT INTO modifiers (modifier_group_id, name, price, sort_order) VALUES
    ((SELECT id FROM modifier_groups WHERE product_id = prod_espresso AND name = 'Extras'), 'Extra Shot', 1.50, 1),
    ((SELECT id FROM modifier_groups WHERE product_id = prod_espresso AND name = 'Extras'), 'Vanilla Syrup', 0.50, 2),
    ((SELECT id FROM modifier_groups WHERE product_id = prod_espresso AND name = 'Extras'), 'Oat Milk', 0.80, 3);

  -- Modifier groups for Aperol Spritz
  INSERT INTO modifier_groups (id, product_id, name, is_required, max_select, sort_order) VALUES
    (uuid_generate_v4(), prod_aperol, 'Size', TRUE, 1, 1);
  INSERT INTO modifiers (modifier_group_id, name, price, sort_order) VALUES
    ((SELECT id FROM modifier_groups WHERE product_id = prod_aperol AND name = 'Size'), 'Regular', 0, 1),
    ((SELECT id FROM modifier_groups WHERE product_id = prod_aperol AND name = 'Size'), 'Large', 3.00, 2);

  -- Modifier for all beers (size)
  -- We'll add modifiers per product in production; for seed, just cocktails

  RAISE NOTICE 'Seed data created for org: %', org_id;
END $$;

-- ============================================
-- ENABLE REALTIME
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE waiter_calls;
ALTER PUBLICATION supabase_realtime ADD TABLE table_sessions;
```

---

## STEP 1: PROJECT STRUCTURE

```
src/
├── app/
│   ├── (guest)/                      # Guest-facing pages (no auth)
│   │   ├── [slug]/[token]/           # Menu page
│   │   │   ├── page.tsx
│   │   │   ├── cart/page.tsx
│   │   │   ├── checkout/page.tsx
│   │   │   └── order/[orderId]/page.tsx
│   │   └── layout.tsx
│   │
│   ├── (dashboard)/                  # Staff dashboard (auth required)
│   │   ├── dashboard/
│   │   │   ├── orders/page.tsx       # Live orders kanban
│   │   │   ├── kitchen/page.tsx      # Kitchen display
│   │   │   ├── waiter-calls/page.tsx
│   │   │   ├── tables/page.tsx
│   │   │   ├── history/page.tsx
│   │   │   └── layout.tsx            # Sidebar layout
│   │   └── layout.tsx
│   │
│   ├── (admin)/                      # Admin panel (owner/manager auth)
│   │   ├── admin/
│   │   │   ├── page.tsx              # Analytics
│   │   │   ├── menu/page.tsx
│   │   │   ├── categories/page.tsx
│   │   │   ├── tables/page.tsx
│   │   │   ├── staff/page.tsx
│   │   │   └── settings/page.tsx     # Stripe Connect
│   │   └── layout.tsx
│   │
│   ├── api/
│   │   ├── stripe/
│   │   │   ├── create-payment-intent/route.ts
│   │   │   ├── webhook/route.ts
│   │   │   └── connect/route.ts
│   │   ├── orders/route.ts
│   │   └── waiter-call/route.ts
│   │
│   ├── auth/
│   │   ├── login/page.tsx
│   │   └── callback/route.ts
│   │
│   ├── layout.tsx
│   ├── page.tsx                      # Landing page
│   └── globals.css
│
├── components/
│   ├── guest/
│   │   ├── MenuGrid.tsx
│   │   ├── ProductCard.tsx
│   │   ├── ProductDetailSheet.tsx
│   │   ├── CategoryPills.tsx
│   │   ├── CartBar.tsx
│   │   ├── CartItem.tsx
│   │   ├── CheckoutForm.tsx
│   │   ├── OrderTracker.tsx
│   │   └── CallWaiterSheet.tsx
│   │
│   ├── dashboard/
│   │   ├── OrderCard.tsx
│   │   ├── OrderKanban.tsx
│   │   ├── KitchenCard.tsx
│   │   ├── KitchenGrid.tsx
│   │   ├── WaiterCallCard.tsx
│   │   ├── Sidebar.tsx
│   │   └── SoundToggle.tsx
│   │
│   └── ui/                           # shadcn/ui components
│       ├── button.tsx
│       ├── sheet.tsx
│       ├── badge.tsx
│       ├── toast.tsx (sonner)
│       └── ...
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # Browser client
│   │   ├── server.ts                 # Server client
│   │   └── types.ts                  # Generated DB types
│   ├── stripe.ts                     # Stripe initialization
│   └── utils.ts
│
├── stores/
│   ├── cart-store.ts                 # Zustand cart store
│   └── session-store.ts             # Zustand guest session store
│
└── hooks/
    ├── use-realtime-orders.ts
    ├── use-realtime-waiter-calls.ts
    └── use-sound.ts
```

---

## STEP 2: ENVIRONMENT VARIABLES

Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## STEP 3: CORE LIBRARIES

Install these packages:
```bash
npm install @supabase/supabase-js @supabase/ssr @stripe/stripe-js @stripe/react-stripe-js stripe zustand framer-motion sonner lucide-react
```

Also install shadcn/ui:
```bash
npx shadcn@latest init
npx shadcn@latest add button sheet badge dialog input textarea select table tabs toast
```

---

## STEP 4: SUPABASE CLIENT SETUP

### `src/lib/supabase/client.ts`
```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### `src/lib/supabase/server.ts`
```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch { /* Server component */ }
        },
      },
    }
  );
}
```

---

## STEP 5: ZUSTAND STORES

### `src/stores/cart-store.ts`
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CartModifier {
  id: string;
  name: string;
  price: number;
}

interface CartItem {
  id: string; // unique cart item ID (not product ID — same product with different modifiers = different cart items)
  productId: string;
  name: string;
  basePrice: number;
  quantity: number;
  modifiers: CartModifier[];
  specialInstructions?: string;
  totalPrice: number; // (basePrice + sum(modifier prices)) * quantity
}

interface CartStore {
  items: CartItem[];
  organizationSlug: string | null;
  tableToken: string | null;

  setContext: (slug: string, token: string) => void;
  addItem: (item: Omit<CartItem, 'id' | 'totalPrice'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;

  getItemCount: () => number;
  getSubtotal: () => number;
  getTax: (rate: number) => number;
  getTotal: (taxRate: number) => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      organizationSlug: null,
      tableToken: null,

      setContext: (slug, token) => set({ organizationSlug: slug, tableToken: token }),

      addItem: (item) => {
        const id = crypto.randomUUID();
        const modifierTotal = item.modifiers.reduce((sum, m) => sum + m.price, 0);
        const totalPrice = (item.basePrice + modifierTotal) * item.quantity;
        set((state) => ({
          items: [...state.items, { ...item, id, totalPrice }],
        }));
      },

      removeItem: (id) => set((state) => ({
        items: state.items.filter((item) => item.id !== id),
      })),

      updateQuantity: (id, quantity) => set((state) => ({
        items: state.items.map((item) => {
          if (item.id !== id) return item;
          const modifierTotal = item.modifiers.reduce((sum, m) => sum + m.price, 0);
          return { ...item, quantity, totalPrice: (item.basePrice + modifierTotal) * quantity };
        }),
      })),

      clearCart: () => set({ items: [] }),

      getItemCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
      getSubtotal: () => get().items.reduce((sum, item) => sum + item.totalPrice, 0),
      getTax: (rate) => get().getSubtotal() * (rate / 100),
      getTotal: (taxRate) => get().getSubtotal() + get().getTax(taxRate),
    }),
    { name: 'qr-order-cart' }
  )
);
```

### `src/stores/session-store.ts`
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SessionStore {
  sessionId: string | null;
  guestId: string;
  tableId: string | null;
  tableName: string | null;
  organizationName: string | null;

  setSession: (data: {
    sessionId: string;
    tableId: string;
    tableName: string;
    organizationName: string;
  }) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionStore>()(
  persist(
    (set) => ({
      sessionId: null,
      guestId: crypto.randomUUID(),
      tableId: null,
      tableName: null,
      organizationName: null,

      setSession: (data) => set(data),
      clearSession: () => set({ sessionId: null, tableId: null, tableName: null, organizationName: null }),
    }),
    { name: 'qr-order-session' }
  )
);
```

---

## STEP 6: BUILD SCREENS IN THIS ORDER

### SCREEN 1: Guest Menu Page — `src/app/(guest)/[slug]/[token]/page.tsx`

**Data flow:**
1. Extract `slug` and `token` from URL params
2. Query Supabase: find the table by `qr_token = token`, join zone → location → organization
3. Verify organization slug matches
4. Fetch all categories + products for this organization (where is_available = TRUE)
5. For each product, fetch modifier_groups + modifiers
6. Create or resume a table_session

**Page structure:**
```
- GuestHeader: org name, org logo, table name badge
- SearchBar: filters products by name (client-side filter)
- CategoryPills: horizontal scroll, auto-highlight on scroll
- MenuGrid: for each category, render category header + 2-column ProductCard grid
- CartBar: sticky bottom, shows count + total, tap opens /cart
```

**Key implementation details:**
- Use server component for initial data fetch, pass to client components
- CategoryPills use IntersectionObserver to highlight active category on scroll
- Tap category pill → smooth scroll to that section
- ProductCard tap behavior:
  - If product has modifier_groups → open ProductDetailSheet
  - If no modifiers → directly call cartStore.addItem with quantity 1
- Search is client-side filtering with 300ms debounce
- CartBar only visible when cart has items (slide-up animation)

### SCREEN 2: Product Detail Sheet — `src/components/guest/ProductDetailSheet.tsx`

**Type:** shadcn Sheet (from bottom, 85% height)

**Content:**
- Product image or gradient placeholder (use product name initial + category-based gradient color)
- Product name + price
- Modifier groups (loop through product's modifier_groups):
  - If max_select = 1: radio group (only one selectable)
  - If max_select > 1: checkbox group
  - Show "(Required)" badge next to group name if is_required
  - Each modifier shows name + "+€X.XX" price
- Special instructions textarea (optional, 2 rows)
- Quantity selector: [-] number [+]
- "Add to Cart · €XX.XX" button — price updates in real-time based on selected modifiers + quantity
- Button disabled if required modifier group has no selection

### SCREEN 3: Cart Page — `src/app/(guest)/[slug]/[token]/cart/page.tsx`

**Data source:** Zustand cart store (client-side only)

**Features:**
- List of cart items with: thumbnail (gradient), name, modifiers list, special instructions, quantity selector, line total
- Swipe-to-delete or trash icon per item
- "Add more items" link → back to menu
- Order summary: subtotal, tax (19%), total
- "Proceed to Payment →" button → navigates to /checkout
- Empty cart state with "Browse Menu" button

### SCREEN 4: Checkout Page — `src/app/(guest)/[slug]/[token]/checkout/page.tsx`

**This is the critical payment screen. Implementation:**

1. On page load, call API route `POST /api/stripe/create-payment-intent` with:
   - cart items (product IDs, quantities, modifier IDs)
   - organization ID
   - table session ID
   
2. The API route:
   - Re-validates prices server-side (NEVER trust client prices)
   - Fetches current product prices + modifier prices from DB
   - Calculates subtotal, tax, total
   - Calls `get_next_order_number(org_id)` for sequential number
   - Creates the order + order_items + order_item_modifiers in DB (status: 'pending', payment_status: 'pending')
   - Creates Stripe PaymentIntent with:
     ```typescript
     const paymentIntent = await stripe.paymentIntents.create({
       amount: Math.round(total * 100), // cents
       currency: 'eur',
       application_fee_amount: Math.round(total * 100 * 0.02), // 2% platform fee
       transfer_data: {
         destination: organization.stripe_account_id,
       },
       metadata: {
         order_id: order.id,
         organization_id: org.id,
       },
     });
     ```
   - Returns { clientSecret, orderId } to frontend

3. Frontend renders:
   - Order summary (condensed, not editable)
   - PaymentElement from Stripe (auto-shows Apple Pay / Google Pay if available)
   - Optional email input for receipt
   - "Pay €XX.XX" button
   
4. On payment success:
   - Redirect to `/[slug]/[token]/order/[orderId]`
   - Clear cart

**Stripe Elements setup:**
```typescript
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// Wrap checkout in Elements provider:
<Elements stripe={stripePromise} options={{
  clientSecret,
  appearance: {
    theme: 'night',
    variables: {
      colorPrimary: '#f97316',
      colorBackground: '#18181b',
      colorText: '#fafafa',
      colorDanger: '#ef4444',
      fontFamily: 'Inter, system-ui, sans-serif',
      borderRadius: '10px',
    },
    rules: {
      '.Input': { border: '1px solid #3f3f46', boxShadow: 'none' },
      '.Input:focus': { border: '1px solid #f97316', boxShadow: '0 0 0 1px #f97316' },
    },
  },
}}>
  <CheckoutForm />
</Elements>
```

### SCREEN 5: Order Tracking — `src/app/(guest)/[slug]/[token]/order/[orderId]/page.tsx`

**Data flow:**
1. Fetch order from DB by orderId
2. Subscribe to real-time changes on this order's status

**Implementation:**
```typescript
// Real-time subscription
const supabase = createClient();
useEffect(() => {
  const channel = supabase
    .channel(`order-${orderId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'orders',
      filter: `id=eq.${orderId}`,
    }, (payload) => {
      setOrder(payload.new);
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [orderId]);
```

**Visual:**
- Success checkmark animation (or red X if rejected)
- Vertical status stepper:
  - Received (with timestamp)
  - Accepted (with timestamp)
  - Preparing (with estimated time)
  - Ready
  - Delivered
- Current step: orange pulsing dot
- Completed: green dot + timestamp
- Upcoming: gray dot
- Order items list below
- "Call Waiter" button
- "Order More" link back to menu

### SCREEN 6: Staff Dashboard — Live Orders Kanban — `src/app/(dashboard)/dashboard/orders/page.tsx`

**Auth:** Requires Supabase auth. Redirect to /auth/login if not authenticated.

**Layout:** Sidebar (Sidebar.tsx) + main content

**Kanban columns:** Pending → Accepted → Preparing → Ready

**Real-time subscription:**
```typescript
// Subscribe to ALL orders for this organization
const channel = supabase
  .channel('dashboard-orders')
  .on('postgres_changes', {
    event: '*', // INSERT, UPDATE, DELETE
    schema: 'public',
    table: 'orders',
    filter: `organization_id=eq.${orgId}`,
  }, (payload) => {
    if (payload.eventType === 'INSERT') {
      // Add to pending column, play sound
      playNewOrderSound();
    }
    if (payload.eventType === 'UPDATE') {
      // Move card to new column
    }
  })
  .subscribe();
```

**Order card actions:**
- Pending: "Accept" (→ accepted) + "Reject" (opens reason dialog → rejected, triggers refund)
- Accepted: "Start Preparing" (→ preparing)
- Preparing: "Mark Ready" (→ ready)
- Ready: "Mark Delivered" (→ delivered, removes from board)

**Status update API:** `PATCH /api/orders` — updates order status. If rejecting, also:
```typescript
// Refund via Stripe
const refund = await stripe.refunds.create({
  payment_intent: order.stripe_payment_intent_id,
});
// Update payment_status to 'refunded'
```

**Sound:** Use Web Audio API. Store sound preference in localStorage. Play a notification sound on new order (INSERT event).

### SCREEN 7: Kitchen Display — `src/app/(dashboard)/dashboard/kitchen/page.tsx`

**Design:** Dark background, large text, optimized for wall-mounted screen or tablet.

**Shows:** Only orders with status 'accepted' or 'preparing' (not pending — kitchen only sees after staff accepts).

**Each card:**
- Table name (LARGE: 40px+)
- Order number (#052)
- Timer since order was accepted (counts up, changes color: white < 5min, yellow 5-10min, red > 10min)
- Order items with quantities
- Status badge (PREPARING / READY)
- Tap to cycle: preparing → ready

**Grid:** 2-4 columns depending on screen width. Auto-sort by age (oldest first).

**Same real-time subscription as dashboard, filtered to status IN ('accepted', 'preparing').**

---

## STEP 7: STRIPE WEBHOOK

### `src/app/api/stripe/webhook/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Service role for webhook
);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent;
      const orderId = pi.metadata.order_id;
      await supabase
        .from('orders')
        .update({ payment_status: 'paid' })
        .eq('id', orderId);
      break;
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object as Stripe.PaymentIntent;
      const orderId = pi.metadata.order_id;
      await supabase
        .from('orders')
        .update({ payment_status: 'failed', status: 'rejected' })
        .eq('id', orderId);
      break;
    }

    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge;
      const pi = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
      if (pi) {
        const { data: order } = await supabase
          .from('orders')
          .select('id')
          .eq('stripe_payment_intent_id', pi)
          .single();
        if (order) {
          await supabase
            .from('orders')
            .update({ payment_status: 'refunded' })
            .eq('id', order.id);
        }
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
```

---

## STEP 8: MIDDLEWARE (Auth for Dashboard/Admin)

### `src/middleware.ts`
```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Protect dashboard and admin routes
  if ((request.nextUrl.pathname.startsWith('/dashboard') || request.nextUrl.pathname.startsWith('/admin')) && !user) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};
```

---

## CRITICAL IMPLEMENTATION NOTES

1. **NEVER trust client-side prices.** Always re-fetch prices from DB when creating PaymentIntent.

2. **Price snapshots:** When creating order_items, save the product price and modifier prices at order time. Even if menu prices change later, the order keeps original prices.

3. **Tax calculation:** Settings from organization.settings.tax_rate (19% Germany). Calculate server-side.

4. **Guest sessions:** Auto-create on first visit. Store session ID in Zustand (persisted to localStorage). Don't require any login or registration from guests.

5. **QR token security:** Use random hex tokens, not sequential IDs. Allow regeneration from admin panel.

6. **Rate limiting:** Add rate limiting on order creation and waiter calls to prevent spam. Simple approach: check last order/call timestamp for this session, require 30-second gap.

7. **Responsive:** Guest app must work perfectly on 375px (iPhone SE) through 428px (iPhone Pro Max). Dashboard must work on 768px+ (tablet) through desktop.

8. **Sound notifications:** Dashboard plays sound on new order (INSERT). Kitchen plays different sound. Use Web Audio API, require user click to enable (browser policy). Persist preference in localStorage.

9. **Error handling:** Every API call should have try/catch. Show toast notifications for errors. Never show raw error messages to guests.

10. **Loading states:** Every page must have skeleton loaders. Use Suspense boundaries. Never show blank white/black screens.

---

## BUILD ORDER

Build and test in exactly this order:
1. Supabase schema + seed data
2. Guest menu page (read-only, just displays menu)
3. Product detail sheet + cart store
4. Cart page
5. Stripe setup + checkout page + payment intent API
6. Order tracking page + real-time subscription
7. Auth setup (Supabase Auth with email/password for staff)
8. Dashboard live orders kanban + real-time
9. Kitchen display
10. Waiter calls (guest + dashboard)

Test each screen before moving to the next. Use seed data for development.
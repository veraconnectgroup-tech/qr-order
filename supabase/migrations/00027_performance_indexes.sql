-- Performance indexes for all major query patterns

-- Orders (dashboard listing, analytics, cron cleanup)
CREATE INDEX IF NOT EXISTS idx_orders_location_created ON orders (location_id, created_at DESC);

DROP INDEX IF EXISTS idx_orders_location_status;
CREATE INDEX idx_orders_location_status ON orders (location_id, status)
  WHERE status NOT IN ('delivered', 'cancelled', 'rejected');
-- idx_orders_session: already exists in 00001 (session_id)

CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders (payment_status)
  WHERE payment_status = 'pending';
-- idx_orders_stripe_pi: already exists as idx_orders_payment in 00001 (stripe_payment_intent_id)

-- Order items
-- idx_order_items_order: already exists in 00001
-- idx_order_item_modifiers_item: already exists in 00001

-- Sessions (token lookup, active sessions)
-- idx_sessions_token: already exists as idx_table_sessions_token in 00001

CREATE INDEX IF NOT EXISTS idx_sessions_table_active ON table_sessions (table_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_sessions_location ON table_sessions (location_id, status);

-- Tables (QR token lookup)
DROP INDEX IF EXISTS idx_tables_qr_token;
CREATE INDEX idx_tables_qr_token ON tables (qr_token)
  WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS idx_tables_location;
CREATE INDEX idx_tables_location ON tables (location_id)
  WHERE deleted_at IS NULL;

-- Products & categories (menu loading)
DROP INDEX IF EXISTS idx_products_category;
CREATE INDEX idx_products_category ON products (category_id, sort_order)
  WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS idx_categories_location;
CREATE INDEX IF NOT EXISTS idx_categories_location_sort ON categories (location_id, sort_order)
  WHERE deleted_at IS NULL;

-- Waiter calls (active calls)
DROP INDEX IF EXISTS idx_waiter_calls_location_status;
CREATE INDEX idx_waiter_calls_location_status ON waiter_calls (location_id, status)
  WHERE status = 'pending';

-- Webhook events (idempotency check)
-- idx_webhook_events_stripe_id: id is PRIMARY KEY (unique index already exists)

-- Staff (auth lookup)
CREATE INDEX IF NOT EXISTS idx_staff_user_org ON staff (user_id, org_id)
  WHERE deleted_at IS NULL;

-- Audit log
CREATE INDEX IF NOT EXISTS idx_audit_log_order ON audit_log (order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log (created_at DESC);

-- Daily order counters
-- idx_daily_counter_location_date: already covered by UNIQUE(location_id, date) on table

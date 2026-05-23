-- RLS hardening: lock down unprotected tables, add scoped guest policies, drop overly broad reads.

-- ===== Tables without RLS =====
ALTER TABLE daily_order_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_daily_order_counters" ON daily_order_counters
  FOR SELECT USING (location_id = ANY(get_user_location_ids()));

CREATE POLICY "staff_insert_daily_order_counters" ON daily_order_counters
  FOR INSERT WITH CHECK (location_id = ANY(get_user_location_ids()));

CREATE POLICY "staff_update_daily_order_counters" ON daily_order_counters
  FOR UPDATE
  USING (location_id = ANY(get_user_location_ids()))
  WITH CHECK (location_id = ANY(get_user_location_ids()));

CREATE POLICY "service_role_only_webhook_events" ON webhook_events
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ===== Drop overly broad guest read policies (if applied manually) =====
DROP POLICY IF EXISTS "Public can read own orders" ON orders;
DROP POLICY IF EXISTS "public_read_orders" ON orders;
DROP POLICY IF EXISTS "Public can read order items" ON order_items;
DROP POLICY IF EXISTS "Public can read order item modifiers" ON order_item_modifiers;
DROP POLICY IF EXISTS "Public can read own sessions" ON table_sessions;

-- ===== Guest INSERT policies (defense-in-depth for direct client Supabase usage) =====
CREATE POLICY "guest_insert_orders" ON orders
  FOR INSERT WITH CHECK (
    status = 'pending' AND payment_status = 'pending'
  );

CREATE POLICY "guest_insert_order_items" ON order_items
  FOR INSERT WITH CHECK (
    order_id IN (SELECT id FROM orders WHERE status = 'pending')
  );

CREATE POLICY "guest_insert_oi_modifiers" ON order_item_modifiers
  FOR INSERT WITH CHECK (
    order_item_id IN (SELECT id FROM order_items)
  );

CREATE POLICY "guest_insert_waiter_call" ON waiter_calls
  FOR INSERT WITH CHECK (
    status = 'pending'
  );

-- ===== Guest SELECT policies (session-scoped) =====
CREATE POLICY "guest_read_own_session" ON table_sessions
  FOR SELECT USING (
    session_token = current_setting('request.headers')::json->>'x-session-token'
  );

CREATE POLICY "guest_read_own_orders" ON orders
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM table_sessions
      WHERE session_token = current_setting('request.headers', true)::json->>'x-session-token'
    )
  );

-- Migration health audit: missing FK indexes (Layer 10 AG1)
-- Safe additive-only changes — no data loss

CREATE INDEX IF NOT EXISTS idx_orders_location_id ON orders(location_id);

CREATE INDEX IF NOT EXISTS idx_ai_sessions_location_created
  ON ai_sessions(location_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_table_sessions_location_status
  ON table_sessions(location_id, status);

COMMENT ON INDEX idx_orders_location_id IS 'AG1: FK index for location-scoped order queries';
COMMENT ON INDEX idx_ai_sessions_location_created IS 'AG1: Denis session history by location';

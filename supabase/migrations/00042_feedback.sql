-- Post-delivery guest feedback (ratings + optional comment)
CREATE TABLE IF NOT EXISTS order_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_location ON order_feedback (location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_rating ON order_feedback (location_id, rating);

ALTER TABLE order_feedback ENABLE ROW LEVEL SECURITY;

-- Guest can submit feedback for orders in their session (defense-in-depth)
CREATE POLICY "guest_create_feedback" ON order_feedback
  FOR INSERT WITH CHECK (
    order_id IN (
      SELECT id FROM orders
      WHERE status = 'delivered'
        AND session_id IN (
          SELECT id FROM table_sessions
          WHERE session_token = current_setting('request.headers', true)::json->>'x-session-token'
        )
    )
    AND location_id = (SELECT location_id FROM orders WHERE id = order_id)
  );

CREATE POLICY "guest_read_own_feedback" ON order_feedback
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM orders
      WHERE session_id IN (
        SELECT id FROM table_sessions
        WHERE session_token = current_setting('request.headers', true)::json->>'x-session-token'
      )
    )
  );

-- Staff read feedback for their locations
CREATE POLICY "staff_view_feedback" ON order_feedback
  FOR SELECT USING (location_id = ANY(get_user_location_ids()));

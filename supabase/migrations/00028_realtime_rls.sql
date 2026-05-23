-- Realtime hardening: ensure orders/waiter_calls are published and RLS-scoped.
-- Staff policies (staff_manage_orders, staff_manage_waiter_calls) apply to
-- postgres_changes — each restaurant only receives rows for its locations.

ALTER TABLE orders REPLICA IDENTITY FULL;
ALTER TABLE waiter_calls REPLICA IDENTITY FULL;

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

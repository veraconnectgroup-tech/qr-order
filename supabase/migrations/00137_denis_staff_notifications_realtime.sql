-- Realtime for Denis staff notifications (in-app bell)

ALTER TABLE denis_staff_notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'denis_staff_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE denis_staff_notifications;
  END IF;
END $$;

-- Rollback:
-- ALTER PUBLICATION supabase_realtime DROP TABLE denis_staff_notifications;

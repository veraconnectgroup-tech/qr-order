-- Realtime: party device cart sync (shared_cart multi-device)
ALTER TABLE denis_party_devices REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'denis_party_devices'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE denis_party_devices;
  END IF;
END $$;

-- Rollback:
-- ALTER PUBLICATION supabase_realtime DROP TABLE denis_party_devices;

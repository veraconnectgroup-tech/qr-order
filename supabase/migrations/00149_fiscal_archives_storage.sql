-- GoBD: immutable fiscal archive bucket for Z-Bon cloud backup (Prompt 82)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fiscal-archives',
  'fiscal-archives',
  false,
  5242880,
  ARRAY['text/html']
)
ON CONFLICT (id) DO NOTHING;

-- Service role only — no public read (GoBD retention)
CREATE POLICY fiscal_archives_service_all ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'fiscal-archives')
  WITH CHECK (bucket_id = 'fiscal-archives');

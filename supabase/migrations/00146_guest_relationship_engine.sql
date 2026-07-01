-- L2 Guest Relationship Engine — visit timeline + behavioral snapshot (consented guests only)

ALTER TABLE denis_guest_memory
  ADD COLUMN IF NOT EXISTS relationship_snapshot JSONB NOT NULL DEFAULT '{"version":1,"timeline":[]}'::jsonb;

COMMENT ON COLUMN denis_guest_memory.relationship_snapshot IS
  'L2 relationship timeline + behavioral patterns (GDPR — consented guests only)';

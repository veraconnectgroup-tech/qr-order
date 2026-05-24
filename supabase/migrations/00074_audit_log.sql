DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'audit_log'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audit_log'
      AND column_name = 'org_id'
  ) THEN
    ALTER TABLE audit_log RENAME TO audit_log_legacy_pre_g3;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_org_created
  ON audit_log (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity
  ON audit_log (entity_type, entity_id);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_log'
      AND policyname = 'Org owners read own audit'
  ) THEN
    CREATE POLICY "Org owners read own audit"
      ON audit_log FOR SELECT
      USING (org_id IN (
        SELECT org_id FROM staff
        WHERE user_id = auth.uid()
          AND role IN ('owner', 'manager')
      ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_log'
      AND policyname = 'Platform admins read all'
  ) THEN
    CREATE POLICY "Platform admins read all"
      ON audit_log FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM staff
        WHERE user_id = auth.uid()
          AND is_platform_admin = true
      ));
  END IF;
END $$;

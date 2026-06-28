-- V1: Denis turn audit trail (GDPR + food safety retention)

CREATE TABLE IF NOT EXISTS denis_audit_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  turn_id TEXT NOT NULL,
  session_id TEXT,
  table_session_id UUID REFERENCES table_sessions(id) ON DELETE SET NULL,
  guest_token_hash TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  guest_input_hash TEXT NOT NULL,
  denis_response TEXT NOT NULL,
  decision_path JSONB NOT NULL DEFAULT '[]'::jsonb,
  data_accessed JSONB NOT NULL DEFAULT '[]'::jsonb,
  allergy_guard_triggered BOOLEAN NOT NULL DEFAULT false,
  order_submitted BOOLEAN NOT NULL DEFAULT false,
  credits_cost NUMERIC(12, 4) NOT NULL DEFAULT 0,
  model TEXT,
  latency_ms INT,
  allergy_detail JSONB,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_denis_audit_location_recorded
  ON denis_audit_entries (location_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_denis_audit_guest_token
  ON denis_audit_entries (location_id, guest_token_hash, recorded_at DESC)
  WHERE guest_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_denis_audit_expires
  ON denis_audit_entries (expires_at);

ALTER TABLE denis_audit_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_denis_audit_entries" ON denis_audit_entries
  FOR SELECT
  USING (location_id = ANY(get_user_location_ids()));

CREATE POLICY "service_role_manage_denis_audit_entries" ON denis_audit_entries
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE denis_audit_entries IS
  'Denis per-turn compliance audit — guest input hashed, allergy rows retained 365d (V1)';

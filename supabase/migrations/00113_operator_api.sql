-- ADR-029 I1: Denis Operator API keys + request audit (Viktor / operator connectors)

CREATE TABLE operator_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{operator:read}',
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_operator_api_keys_org
  ON operator_api_keys (org_id)
  WHERE revoked_at IS NULL;

CREATE INDEX idx_operator_api_keys_hash
  ON operator_api_keys (key_hash)
  WHERE revoked_at IS NULL;

CREATE TABLE operator_api_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key_id UUID NOT NULL REFERENCES operator_api_keys(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  latency_ms INTEGER,
  trace_id TEXT,
  include_pii BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_operator_api_audit_org_created
  ON operator_api_audit (org_id, created_at DESC);

CREATE INDEX idx_operator_api_audit_key_created
  ON operator_api_audit (key_id, created_at DESC);

ALTER TABLE operator_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_api_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only_operator_api_keys" ON operator_api_keys
  FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY "service_role_only_operator_api_audit" ON operator_api_audit
  FOR ALL USING (false) WITH CHECK (false);

COMMENT ON TABLE operator_api_keys IS
  'ADR-029: Bearer dns_op_live_* keys for /api/operator/v1/ (org-scoped)';

COMMENT ON TABLE operator_api_audit IS
  'ADR-029: Audit log for every Operator API request';

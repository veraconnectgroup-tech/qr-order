-- ADR-028 I5: Operator config/playbook proposals (Viktor propose flow)

CREATE TABLE operator_config_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'config' CHECK (kind IN ('config', 'playbook')),
  patch JSONB NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_by_key_id UUID REFERENCES operator_api_keys(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_operator_config_proposals_org_status
  ON operator_config_proposals (org_id, status, created_at DESC);

CREATE INDEX idx_operator_config_proposals_location
  ON operator_config_proposals (location_id, status);

CREATE TABLE config_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  changed_by TEXT NOT NULL CHECK (changed_by IN ('admin', 'owner', 'operator_proposal')),
  config_path TEXT,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  proposal_id UUID REFERENCES operator_config_proposals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_config_change_log_org_created
  ON config_change_log (org_id, created_at DESC);

ALTER TABLE operator_config_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only_operator_config_proposals" ON operator_config_proposals
  FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY "service_role_only_config_change_log" ON config_change_log
  FOR ALL USING (false) WITH CHECK (false);

COMMENT ON TABLE operator_config_proposals IS
  'ADR-028 I5: Viktor/operator config & playbook proposals — owner approves in admin';

COMMENT ON TABLE config_change_log IS
  'ADR-028 P4: Audit trail for concierge config changes';

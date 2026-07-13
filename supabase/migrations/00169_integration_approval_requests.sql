-- ADR-052 §C steps 13-14 / §R Faza 5 — human review gate. An adapter
-- version can only reach 'human_reviewed' status (the precondition for
-- becoming the adapter's current_version_id, and eventually canary/
-- certified) through a row here with decision='approved', written by a
-- requirePlatformAdmin()-gated action. Nothing else may set that status.

-- One row per review attempt; a pending row transitions to approved/rejected
-- in place (UPDATE, never a second INSERT) — the repair loop's own
-- versioning (new version_number) is what "try again" means here, not a
-- second approval request against the same version.
CREATE TABLE integration_approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adapter_version_id UUID NOT NULL REFERENCES integration_adapter_versions(id) ON DELETE CASCADE,
  requested_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decision TEXT NOT NULL DEFAULT 'pending' CHECK (decision IN ('pending', 'approved', 'rejected')),
  reviewed_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  CHECK (decision = 'pending' OR (reviewed_by_staff_id IS NOT NULL AND reviewed_at IS NOT NULL))
);

-- The real "at most one open review per version" guard.
CREATE UNIQUE INDEX idx_integration_approval_requests_one_pending
  ON integration_approval_requests (adapter_version_id)
  WHERE decision = 'pending';

CREATE INDEX idx_integration_approval_requests_version
  ON integration_approval_requests (adapter_version_id);

ALTER TABLE integration_approval_requests ENABLE ROW LEVEL SECURITY;

-- Platform-level table (adapters aren't scoped to one restaurant), same
-- policy shape as the rest of the ADR-052 schema in 00168.
CREATE POLICY "service_role_integration_approval_requests" ON integration_approval_requests
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE integration_approval_requests IS
  'ADR-052 §C steps 13-14 — human review gate before an AI-generated adapter version can be activated.';

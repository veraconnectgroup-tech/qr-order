-- ADR-009 F7: org-level commercial billing events (purchases — no ai_session)

CREATE TABLE IF NOT EXISTS org_billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_billing_events_org
  ON org_billing_events (org_id, created_at DESC);

ALTER TABLE org_billing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_org_billing_events" ON org_billing_events
  FOR SELECT
  USING (org_id = ANY(get_user_org_ids()));

COMMENT ON TABLE org_billing_events IS
  'ADR-009 F7: org-level billing spine events (e.g. billing.credits_purchased)';

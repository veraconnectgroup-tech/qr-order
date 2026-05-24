CREATE TABLE dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  job_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  error_message TEXT,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_dlq_unresolved
  ON dead_letter_queue (org_id)
  WHERE resolved_at IS NULL;

ALTER TABLE dead_letter_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins read DLQ"
  ON dead_letter_queue FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM staff
    WHERE staff.user_id = auth.uid()
      AND staff.is_platform_admin = true
  ));

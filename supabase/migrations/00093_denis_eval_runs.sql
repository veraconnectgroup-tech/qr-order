-- M24: Denis golden-eval regression history (platform scope)

CREATE TABLE IF NOT EXISTS denis_eval_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'ci'
    CHECK (source IN ('ci', 'manual', 'admin')),
  git_sha TEXT,
  scenario_count INT NOT NULL CHECK (scenario_count >= 0),
  passed INT NOT NULL CHECK (passed >= 0),
  failed INT NOT NULL CHECK (failed >= 0),
  ok BOOLEAN NOT NULL,
  shadow_parity_threshold DECIMAL(4, 3) NOT NULL
    CHECK (shadow_parity_threshold >= 0 AND shadow_parity_threshold <= 1),
  results JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_denis_eval_runs_created
  ON denis_eval_runs (created_at DESC);

ALTER TABLE denis_eval_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_denis_eval_runs ON denis_eval_runs
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY platform_admin_read_denis_eval_runs ON denis_eval_runs
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM staff
    WHERE staff.user_id = auth.uid()
      AND staff.is_platform_admin = true
  ));

COMMENT ON TABLE denis_eval_runs IS
  'Golden kernel eval suite runs — CI regression history (ADR-005 §9)';

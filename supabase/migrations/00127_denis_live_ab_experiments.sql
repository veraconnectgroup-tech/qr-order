-- Layer 4 M1: live A/B experiments per location (max one running)

CREATE TABLE IF NOT EXISTS denis_ab_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  metric TEXT NOT NULL CHECK (
    metric IN (
      'conversion_rate',
      'avg_order_value',
      'upsell_accept_rate',
      'time_to_first_order'
    )
  ),
  variant_a_config JSONB NOT NULL DEFAULT '{}',
  variant_b_config JSONB NOT NULL DEFAULT '{}',
  traffic_split NUMERIC(4, 3) NOT NULL DEFAULT 0.5 CHECK (traffic_split > 0 AND traffic_split < 1),
  min_sessions INTEGER NOT NULL DEFAULT 100 CHECK (min_sessions >= 100),
  auto_apply BOOLEAN NOT NULL DEFAULT false,
  owner_approved_apply BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'stopped')),
  winner TEXT CHECK (winner IN ('A', 'B', 'inconclusive')),
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS denis_ab_one_running_per_location
  ON denis_ab_experiments (location_id)
  WHERE status = 'running';

CREATE TABLE IF NOT EXISTS denis_ab_session_assignments (
  experiment_id UUID NOT NULL REFERENCES denis_ab_experiments(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL,
  variant TEXT NOT NULL CHECK (variant IN ('A', 'B')),
  converted BOOLEAN NOT NULL DEFAULT false,
  order_value_cents INTEGER NOT NULL DEFAULT 0,
  upsell_accepted BOOLEAN NOT NULL DEFAULT false,
  minutes_to_first_order NUMERIC(8, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (experiment_id, session_token)
);

CREATE INDEX IF NOT EXISTS denis_ab_assignments_experiment_idx
  ON denis_ab_session_assignments (experiment_id);

ALTER TABLE denis_ab_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE denis_ab_session_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY denis_ab_experiments_service ON denis_ab_experiments
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY denis_ab_assignments_service ON denis_ab_session_assignments
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE denis_ab_experiments IS
  'Layer 4 M1: live Denis A/B experiments — one running per location';

-- Rollback:
-- DROP TABLE IF EXISTS denis_ab_session_assignments;
-- DROP TABLE IF EXISTS denis_ab_experiments;

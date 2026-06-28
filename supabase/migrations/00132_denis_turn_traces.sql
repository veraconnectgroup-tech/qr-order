-- Denis turn traces for structured debugging / replay (Layer 10 AF1)
-- Retention: 7 days via cron cleanup

CREATE TABLE IF NOT EXISTS denis_turn_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id TEXT NOT NULL,
  ai_session_id TEXT NOT NULL,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_duration_ms INTEGER,
  tier TEXT,
  llm_used BOOLEAN,
  total_tokens INTEGER,
  trace_data JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_denis_turn_traces_session
  ON denis_turn_traces(ai_session_id);

CREATE INDEX IF NOT EXISTS idx_denis_turn_traces_location_created
  ON denis_turn_traces(location_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_denis_turn_traces_created
  ON denis_turn_traces(created_at);

ALTER TABLE denis_turn_traces ENABLE ROW LEVEL SECURITY;

CREATE POLICY denis_turn_traces_service_role ON denis_turn_traces
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE denis_turn_traces IS
  'Structured Denis turn traces for staff debug / replay. Guest input retained 7 days.';

-- M8: Denis anticipation schedules (ADR-004 §9 — Postgres + cron v1)

CREATE TABLE IF NOT EXISTS denis_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_session_id UUID NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  intent_type TEXT NOT NULL,
  run_at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
  dedupe_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  UNIQUE (ai_session_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_denis_schedules_due
  ON denis_schedules (run_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_denis_schedules_session
  ON denis_schedules (ai_session_id, status);

ALTER TABLE denis_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_denis_schedules" ON denis_schedules
  FOR SELECT
  USING (
    location_id = ANY(get_user_location_ids())
  );

COMMENT ON TABLE denis_schedules IS
  'Denis anticipation jobs — evaluated by cron tick (ADR-004/M8)';

CREATE OR REPLACE FUNCTION claim_due_denis_schedules(p_limit INT DEFAULT 50)
RETURNS SETOF denis_schedules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE denis_schedules s
     SET status = 'processing'
   WHERE s.id IN (
     SELECT s2.id
       FROM denis_schedules s2
      WHERE s2.status = 'pending'
        AND s2.run_at <= now()
      ORDER BY s2.run_at ASC
      LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
      FOR UPDATE SKIP LOCKED
   )
  RETURNING s.*;
END;
$$;

REVOKE ALL ON FUNCTION claim_due_denis_schedules(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_due_denis_schedules(INT) TO service_role;

-- M2: Denis event-sourced timeline (append-only) + per-session seq RPC

CREATE TABLE IF NOT EXISTS denis_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_session_id UUID NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
  seq BIGINT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  trace_id TEXT,
  context_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ai_session_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_denis_timeline_session
  ON denis_timeline (ai_session_id, seq);

CREATE INDEX IF NOT EXISTS idx_denis_timeline_trace
  ON denis_timeline (trace_id)
  WHERE trace_id IS NOT NULL;

ALTER TABLE denis_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_denis_timeline" ON denis_timeline
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ai_sessions s
      WHERE s.id = denis_timeline.ai_session_id
        AND s.org_id = ANY(get_user_org_ids())
    )
  );

COMMENT ON TABLE denis_timeline IS
  'Append-only Denis turn history — source of truth for replay (ADR-003/M2)';

-- Atomic per-session sequence + insert (service role / RPC only)
CREATE OR REPLACE FUNCTION append_denis_timeline_event(
  p_ai_session_id UUID,
  p_event_type TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_trace_id TEXT DEFAULT NULL,
  p_context_hash TEXT DEFAULT NULL
)
RETURNS denis_timeline
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq BIGINT;
  v_row denis_timeline;
BEGIN
  IF p_ai_session_id IS NULL OR p_event_type IS NULL OR length(trim(p_event_type)) = 0 THEN
    RAISE EXCEPTION 'append_denis_timeline_event: ai_session_id and event_type required';
  END IF;

  SELECT COALESCE(MAX(t.seq), 0) + 1
    INTO v_seq
    FROM denis_timeline t
   WHERE t.ai_session_id = p_ai_session_id;

  INSERT INTO denis_timeline (
    ai_session_id,
    seq,
    event_type,
    payload,
    trace_id,
    context_hash
  )
  VALUES (
    p_ai_session_id,
    v_seq,
    p_event_type,
    COALESCE(p_payload, '{}'::jsonb),
    NULLIF(trim(p_trace_id), ''),
    NULLIF(trim(p_context_hash), '')
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION append_denis_timeline_event(UUID, TEXT, JSONB, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION append_denis_timeline_event(UUID, TEXT, JSONB, TEXT, TEXT) TO service_role;

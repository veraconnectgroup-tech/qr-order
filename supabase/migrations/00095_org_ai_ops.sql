-- ADR-009 F5: org-level AI ops read model (projection, not source of truth)

CREATE TABLE IF NOT EXISTS org_ai_ops (
  org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  credit_balance INTEGER NOT NULL DEFAULT 0,
  lifetime_used INTEGER NOT NULL DEFAULT 0,
  turns_24h INTEGER NOT NULL DEFAULT 0,
  timeline_events_24h INTEGER NOT NULL DEFAULT 0,
  low_balance BOOLEAN NOT NULL DEFAULT false,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_ai_ops_low_balance
  ON org_ai_ops (low_balance, refreshed_at DESC)
  WHERE low_balance = true;

ALTER TABLE org_ai_ops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_org_ai_ops" ON org_ai_ops
  FOR SELECT
  USING (org_id = ANY(get_user_org_ids()));

COMMENT ON TABLE org_ai_ops IS
  'ADR-009 F5: projected AI commercial + ops metrics per org — refresh via RPC/cron';

CREATE OR REPLACE FUNCTION refresh_org_ai_ops(p_org_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_threshold INTEGER := 10;
BEGIN
  INSERT INTO org_ai_ops (
    org_id,
    credit_balance,
    lifetime_used,
    turns_24h,
    timeline_events_24h,
    low_balance,
    refreshed_at
  )
  SELECT
    o.id,
    COALESCE(c.balance, 0),
    COALESCE(c.lifetime_used, 0),
    COALESCE((
      SELECT COUNT(*)::INTEGER
      FROM denis_timeline dt
      JOIN ai_sessions s ON s.id = dt.ai_session_id
      WHERE s.org_id = o.id
        AND dt.event_type = 'billing.turn_debited'
        AND dt.created_at >= now() - interval '24 hours'
    ), 0),
    COALESCE((
      SELECT COUNT(*)::INTEGER
      FROM denis_timeline dt
      JOIN ai_sessions s ON s.id = dt.ai_session_id
      WHERE s.org_id = o.id
        AND dt.created_at >= now() - interval '24 hours'
    ), 0),
    COALESCE(c.balance, 0) <= v_threshold,
    now()
  FROM organizations o
  LEFT JOIN ai_credits c ON c.org_id = o.id
  WHERE p_org_id IS NULL OR o.id = p_org_id
  ON CONFLICT (org_id) DO UPDATE
  SET
    credit_balance = EXCLUDED.credit_balance,
    lifetime_used = EXCLUDED.lifetime_used,
    turns_24h = EXCLUDED.turns_24h,
    timeline_events_24h = EXCLUDED.timeline_events_24h,
    low_balance = EXCLUDED.low_balance,
    refreshed_at = EXCLUDED.refreshed_at;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION refresh_org_ai_ops(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION refresh_org_ai_ops(UUID) TO service_role;

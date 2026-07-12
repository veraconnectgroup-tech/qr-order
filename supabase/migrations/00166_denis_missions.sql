-- Guest Conduct Policy Engine — generalized staff task system. Generalizes
-- table_bus_obligations (table_id/assigned_staff_id become nullable, a
-- kind + payload JSONB replace bus-specific hardcoded fields) so one table
-- serves conduct handoffs, rule-confirmation nudges, and future arbitrary
-- staff tasks without a schema migration per new mission type.
-- Not yet written to by any live code path — MVP-1/2/3 (deterministic
-- ladder + LLM tone assessment) run entirely in shadow mode and don't
-- create missions. This table exists so MVP-4 (handoff → mission
-- creation) can be built without a further migration once shadow-mode
-- review clears the ladder for live use.

CREATE TABLE denis_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN (
    'guest_conduct_handoff',
    'rule_confirmation_needed',
    'kitchen_question',
    'bar_question',
    'custom'
  )),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed', 'cancelled')),
  assigned_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  assigned_role TEXT CHECK (assigned_role IN ('waiter', 'kitchen', 'bar', 'manager')),
  table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
  ai_session_id UUID REFERENCES ai_sessions(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) >= 1 AND length(title) <= 200),
  summary TEXT NOT NULL CHECK (length(summary) <= 1000),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
  sla_minutes INTEGER CHECK (sla_minutes IS NULL OR sla_minutes > 0),
  reminder_sent_at TIMESTAMPTZ,
  escalated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_denis_missions_location_open
  ON denis_missions (location_id, created_at)
  WHERE status = 'open';

CREATE INDEX idx_denis_missions_assigned_staff_open
  ON denis_missions (assigned_staff_id, created_at)
  WHERE status = 'open' AND assigned_staff_id IS NOT NULL;

CREATE INDEX idx_denis_missions_ai_session
  ON denis_missions (ai_session_id)
  WHERE ai_session_id IS NOT NULL;

CREATE INDEX idx_denis_missions_sla_watch
  ON denis_missions (location_id, sla_minutes, created_at)
  WHERE status = 'open' AND sla_minutes IS NOT NULL AND escalated_at IS NULL;

ALTER TABLE denis_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_denis_missions" ON denis_missions
  FOR ALL USING (location_id = ANY(get_user_location_ids()));

CREATE POLICY "service_role_denis_missions" ON denis_missions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE denis_missions REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'denis_missions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE denis_missions;
  END IF;
END $$;

COMMENT ON TABLE denis_missions IS
  'Guest Conduct Policy Engine — generalized staff task system (handoffs, rule confirmations, kitchen/bar questions). Not yet written to by any live code path as of this migration.';

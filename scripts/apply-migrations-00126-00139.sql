-- Manual apply: pending migrations 00126-00139
-- Run in Supabase Dashboard → SQL Editor (after Unban IP)
-- https://supabase.com/dashboard/project/mcumfksxujgtjfjfwtpl/sql/new
BEGIN;
-- ===== 00126_guest_memory_dessert_skip.sql =====
-- J2: Remember dessert nudge dismissals across visits

ALTER TABLE denis_guest_memory
  ADD COLUMN IF NOT EXISTS dessert_nudge_dismiss_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skip_dessert_nudge BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN denis_guest_memory.dessert_nudge_dismiss_count IS
  'Times guest dismissed dessert_nudge — J2 banner learning';
COMMENT ON COLUMN denis_guest_memory.skip_dessert_nudge IS
  'When true, suppress dessert_nudge proactive offers for this guest';

-- ===== 00127_denis_live_ab_experiments.sql =====
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

-- ===== 00128_commerce_preorders.sql =====
-- P3 — scheduled preorders (ADR-014 F6 spine)

CREATE TABLE commerce_preorders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
  guest_id TEXT NOT NULL,
  session_id UUID REFERENCES table_sessions(id) ON DELETE SET NULL,
  items JSONB NOT NULL DEFAULT '[]',
  scheduled_for TIMESTAMPTZ NOT NULL,
  kitchen_release_at TIMESTAMPTZ NOT NULL,
  no_show_cancel_at TIMESTAMPTZ NOT NULL,
  note TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('online', 'on_arrival')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'cancelled')),
  prep_time_minutes INT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, idempotency_key)
);

CREATE INDEX idx_commerce_preorders_location_scheduled
  ON commerce_preorders (location_id, scheduled_for);

CREATE INDEX idx_commerce_preorders_status_release
  ON commerce_preorders (status, kitchen_release_at);

ALTER TABLE commerce_preorders ENABLE ROW LEVEL SECURITY;

CREATE POLICY commerce_preorders_org_read ON commerce_preorders
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM staff
      WHERE user_id = auth.uid() AND is_active = true AND deleted_at IS NULL
    )
  );

COMMENT ON TABLE commerce_preorders IS
  'ADR-014 P3 — guest scheduled preorders; kitchen release via QStash job';

-- ===== 00129_guest_memory_review_funnel.sql =====
-- Q1: Google review funnel anti-spam on guest memory

ALTER TABLE denis_guest_memory
  ADD COLUMN IF NOT EXISTS last_review_prompt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_review_dismiss_at TIMESTAMPTZ;

COMMENT ON COLUMN denis_guest_memory.last_review_prompt_at IS
  'Last time Denis showed Google review prompt — max 1 per 90 days (Q1).';
COMMENT ON COLUMN denis_guest_memory.last_review_dismiss_at IS
  'Guest tapped Not now on Google review — suppress 180 days (Q1).';

-- Extend commerce finalize for review click tracking
CREATE OR REPLACE FUNCTION finalize_commerce_experience_command(
  p_org_id UUID,
  p_location_id UUID,
  p_session_id UUID,
  p_order_id UUID,
  p_command_type TEXT,
  p_event_type TEXT,
  p_payload JSONB,
  p_idempotency_key TEXT,
  p_trace_id TEXT DEFAULT NULL,
  p_schema_version SMALLINT DEFAULT 1
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id UUID;
  v_event_id UUID;
  v_payload JSONB;
  v_rating INTEGER;
  v_sentiment TEXT;
  v_comment TEXT;
  v_category TEXT;
  v_trigger_moment TEXT;
  v_order_id UUID;
BEGIN
  IF p_org_id IS NULL OR p_location_id IS NULL OR p_session_id IS NULL THEN
    RAISE EXCEPTION 'finalize_commerce_experience_command: org_id, location_id, session_id required';
  END IF;

  IF NULLIF(trim(p_command_type), '') IS NULL OR NULLIF(trim(p_event_type), '') IS NULL THEN
    RAISE EXCEPTION 'finalize_commerce_experience_command: command_type and event_type required';
  END IF;

  IF NULLIF(trim(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'finalize_commerce_experience_command: idempotency_key required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM table_sessions ts
    JOIN locations loc ON loc.id = ts.location_id
    WHERE ts.id = p_session_id
      AND ts.location_id = p_location_id
      AND loc.org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'finalize_commerce_experience_command: session/org/location mismatch';
  END IF;

  IF p_command_type = 'SubmitFeedback' THEN
    IF EXISTS (
      SELECT 1 FROM order_feedback WHERE session_id = p_session_id
    ) OR EXISTS (
      SELECT 1 FROM guest_session_commerce_state
      WHERE session_id = p_session_id AND feedback_submitted = true
    ) THEN
      RAISE EXCEPTION 'feedback_already_submitted' USING ERRCODE = '23505';
    END IF;
  END IF;

  SELECT id INTO v_existing_id
  FROM commerce_experience_events
  WHERE session_id = p_session_id
    AND idempotency_key = p_idempotency_key;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  v_payload := COALESCE(p_payload, '{}'::jsonb);
  v_order_id := COALESCE(p_order_id, NULLIF(v_payload->>'orderId', '')::uuid);

  INSERT INTO commerce_experience_events (
    org_id,
    location_id,
    session_id,
    order_id,
    command_type,
    event_type,
    schema_version,
    payload,
    idempotency_key,
    trace_id
  )
  VALUES (
    p_org_id,
    p_location_id,
    p_session_id,
    v_order_id,
    p_command_type,
    p_event_type,
    COALESCE(p_schema_version, 1),
    v_payload,
    p_idempotency_key,
    NULLIF(trim(p_trace_id), '')
  )
  RETURNING id INTO v_event_id;

  IF p_command_type = 'SubmitFeedback' THEN
    v_rating := NULLIF(v_payload->>'rating', '')::integer;
    v_sentiment := NULLIF(v_payload->>'sentiment', '');
    v_comment := NULLIF(v_payload->>'comment', '');
    v_category := NULLIF(v_payload->>'category', '');
    v_trigger_moment := COALESCE(NULLIF(v_payload->>'triggerMoment', ''), 'order_delivered');

    IF v_rating IS NULL OR v_sentiment IS NULL THEN
      RAISE EXCEPTION 'SubmitFeedback requires rating and sentiment in payload';
    END IF;

    INSERT INTO order_feedback (
      order_id,
      location_id,
      org_id,
      session_id,
      rating,
      comment,
      sentiment,
      category,
      trigger_moment
    )
    VALUES (
      v_order_id,
      p_location_id,
      p_org_id,
      p_session_id,
      v_rating,
      v_comment,
      v_sentiment,
      v_category,
      v_trigger_moment
    );

    INSERT INTO feedback_inbox (
      org_id,
      location_id,
      session_id,
      order_id,
      commerce_event_id,
      sentiment,
      category,
      rating,
      comment,
      needs_response
    )
    VALUES (
      p_org_id,
      p_location_id,
      p_session_id,
      v_order_id,
      v_event_id,
      v_sentiment,
      v_category,
      v_rating,
      v_comment,
      v_sentiment = 'negative'
    );

    IF v_sentiment = 'negative' THEN
      INSERT INTO outbox_events (
        aggregate_type,
        aggregate_id,
        domain,
        event_type,
        payload
      )
      VALUES (
        'session',
        p_session_id,
        'commerce',
        'commerce.alert.staff',
        jsonb_build_object(
          'commerceEventId', v_event_id,
          'sessionId', p_session_id,
          'locationId', p_location_id,
          'orgId', p_org_id,
          'orderId', v_order_id,
          'sentiment', v_sentiment,
          'category', v_category,
          'traceId', NULLIF(trim(p_trace_id), '')
        )
      );
    END IF;
  END IF;

  IF p_command_type = 'RecordGoogleReviewClick' THEN
    UPDATE order_feedback
    SET google_review_clicked = true
    WHERE session_id = p_session_id;
  END IF;

  INSERT INTO outbox_events (
    aggregate_type,
    aggregate_id,
    domain,
    event_type,
    payload
  )
  VALUES (
    'session',
    p_session_id,
    'commerce',
    'commerce.projection.refresh',
    jsonb_build_object(
      'commerceEventId', v_event_id,
      'sessionId', p_session_id,
      'eventType', p_event_type,
      'traceId', NULLIF(trim(p_trace_id), '')
    )
  );

  RETURN v_event_id;
END;
$$;

-- ===== 00130_guest_engagement_retention.sql =====
-- Q2: Between-visit guest engagement (consent + send log)

ALTER TABLE denis_guest_memory
  ADD COLUMN IF NOT EXISTS engagement_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS birthday_month SMALLINT CHECK (birthday_month IS NULL OR birthday_month BETWEEN 1 AND 12),
  ADD COLUMN IF NOT EXISTS win_back_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS engagement_month_key TEXT,
  ADD COLUMN IF NOT EXISTS engagement_month_count INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN denis_guest_memory.engagement_consent_at IS
  'GDPR opt-in for between-visit engagement messages (Q2).';
COMMENT ON COLUMN denis_guest_memory.win_back_sent_at IS
  'One-shot win-back message — no follow-up if guest ignores (Q2).';

CREATE TABLE IF NOT EXISTS denis_guest_engagement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  guest_token TEXT NOT NULL,
  trigger TEXT NOT NULL CHECK (
    trigger IN (
      'weekly_special',
      'birthday',
      'win_back',
      'event_invite',
      'loyalty_milestone'
    )
  ),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'push', 'sms')),
  message TEXT NOT NULL,
  personalized_offer TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  returned_at TIMESTAMPTZ,
  ordered_item BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guest_engagement_location_sent
  ON denis_guest_engagement_events (location_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_guest_engagement_guest
  ON denis_guest_engagement_events (location_id, guest_token, sent_at DESC);

ALTER TABLE denis_guest_engagement_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY guest_engagement_events_staff ON denis_guest_engagement_events
  FOR SELECT USING (location_id = ANY(get_user_location_ids()));

COMMENT ON TABLE denis_guest_engagement_events IS
  'Between-visit Denis engagement sends — retention analytics (Q2).';

-- ===== 00131_denis_audit_trail.sql =====
-- V1: Denis turn audit trail (GDPR + food safety retention)

CREATE TABLE IF NOT EXISTS denis_audit_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  turn_id TEXT NOT NULL,
  session_id TEXT,
  table_session_id UUID REFERENCES table_sessions(id) ON DELETE SET NULL,
  guest_token_hash TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  guest_input_hash TEXT NOT NULL,
  denis_response TEXT NOT NULL,
  decision_path JSONB NOT NULL DEFAULT '[]'::jsonb,
  data_accessed JSONB NOT NULL DEFAULT '[]'::jsonb,
  allergy_guard_triggered BOOLEAN NOT NULL DEFAULT false,
  order_submitted BOOLEAN NOT NULL DEFAULT false,
  credits_cost NUMERIC(12, 4) NOT NULL DEFAULT 0,
  model TEXT,
  latency_ms INT,
  allergy_detail JSONB,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_denis_audit_location_recorded
  ON denis_audit_entries (location_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_denis_audit_guest_token
  ON denis_audit_entries (location_id, guest_token_hash, recorded_at DESC)
  WHERE guest_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_denis_audit_expires
  ON denis_audit_entries (expires_at);

ALTER TABLE denis_audit_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_denis_audit_entries" ON denis_audit_entries
  FOR SELECT
  USING (location_id = ANY(get_user_location_ids()));

CREATE POLICY "service_role_manage_denis_audit_entries" ON denis_audit_entries
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE denis_audit_entries IS
  'Denis per-turn compliance audit — guest input hashed, allergy rows retained 365d (V1)';

-- ===== 00132_denis_turn_traces.sql =====
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

-- ===== 00133_health_audit_indexes.sql =====
-- Migration health audit: missing FK indexes (Layer 10 AG1)
-- Safe additive-only changes — no data loss

CREATE INDEX IF NOT EXISTS idx_orders_location_id ON orders(location_id);

CREATE INDEX IF NOT EXISTS idx_ai_sessions_location_created
  ON ai_sessions(location_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_table_sessions_location_status
  ON table_sessions(location_id, status);

COMMENT ON INDEX idx_orders_location_id IS 'AG1: FK index for location-scoped order queries';
COMMENT ON INDEX idx_ai_sessions_location_created IS 'AG1: Denis session history by location';

-- ===== 00134_experience_analytics_roi.sql =====
-- Layer 11 AI1: Denis ROI metrics on daily experience rollup

ALTER TABLE experience_analytics_daily
  ADD COLUMN IF NOT EXISTS converted_sessions INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS upsell_revenue_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_cost_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS t0_turns INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS llm_turns INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS returning_guest_sessions INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS order_time_seconds_total INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS by_nudge_revenue JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN experience_analytics_daily.converted_sessions IS
  'Layer 11: sessions with at least one paid order (Denis-attributed)';

COMMENT ON COLUMN experience_analytics_daily.upsell_revenue_total IS
  'Layer 11: revenue from accepted upsell/pairing nudges';

COMMENT ON COLUMN experience_analytics_daily.ai_cost_cents IS
  'Layer 11: OpenAI / LLM cost for Denis turns on this day';

COMMENT ON COLUMN experience_analytics_daily.t0_turns IS
  'Layer 11: T0 reflex turns (no LLM cost)';

COMMENT ON COLUMN experience_analytics_daily.llm_turns IS
  'Layer 11: LLM-backed Denis turns';

COMMENT ON COLUMN experience_analytics_daily.returning_guest_sessions IS
  'Layer 11: sessions from guests seen within prior 30 days';

COMMENT ON COLUMN experience_analytics_daily.order_time_seconds_total IS
  'Layer 11: sum of seconds from session open to first order';

COMMENT ON COLUMN experience_analytics_daily.by_nudge_revenue IS
  'Layer 11: nudge category → { accepted, revenue } for top performers';

-- Rollback:
-- ALTER TABLE experience_analytics_daily
--   DROP COLUMN IF EXISTS converted_sessions,
--   DROP COLUMN IF EXISTS upsell_revenue_total,
--   DROP COLUMN IF EXISTS ai_cost_cents,
--   DROP COLUMN IF EXISTS t0_turns,
--   DROP COLUMN IF EXISTS llm_turns,
--   DROP COLUMN IF EXISTS returning_guest_sessions,
--   DROP COLUMN IF EXISTS order_time_seconds_total,
--   DROP COLUMN IF EXISTS by_nudge_revenue;

-- ===== 00135_experience_score.sql =====
-- Layer 11 AI2: daily Denis experience score on experience rollup

ALTER TABLE experience_analytics_daily
  ADD COLUMN IF NOT EXISTS experience_score NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS experience_score_components JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS abandoned_sessions INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cart_corrections INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repeated_questions INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_turns INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN experience_analytics_daily.experience_score IS
  'Layer 11: automated guest experience score 0–100';

COMMENT ON COLUMN experience_analytics_daily.experience_score_components IS
  'Layer 11: score component breakdown (conversion, efficiency, accuracy, satisfaction)';

-- Rollback:
-- ALTER TABLE experience_analytics_daily
--   DROP COLUMN IF EXISTS experience_score,
--   DROP COLUMN IF EXISTS experience_score_components,
--   DROP COLUMN IF EXISTS abandoned_sessions,
--   DROP COLUMN IF EXISTS cart_corrections,
--   DROP COLUMN IF EXISTS repeated_questions,
--   DROP COLUMN IF EXISTS total_turns;

-- ===== 00136_denis_staff_notifications.sql =====
-- Layer 11 AK4: in-app Denis staff notifications (push + bell)

CREATE TABLE IF NOT EXISTS denis_staff_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  message TEXT NOT NULL,
  table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
  table_name TEXT,
  action_url TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_denis_staff_notifications_location_unread
  ON denis_staff_notifications (location_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_denis_staff_notifications_location_created
  ON denis_staff_notifications (location_id, created_at DESC);

ALTER TABLE denis_staff_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY staff_read_denis_staff_notifications ON denis_staff_notifications
  FOR SELECT
  USING (location_id = ANY(get_user_location_ids()));

CREATE POLICY staff_update_denis_staff_notifications ON denis_staff_notifications
  FOR UPDATE
  USING (location_id = ANY(get_user_location_ids()))
  WITH CHECK (location_id = ANY(get_user_location_ids()));

COMMENT ON TABLE denis_staff_notifications IS
  'Layer 11: Denis staff alerts (allergy, high value order, escalation) — in-app bell + push';

-- Rollback:
-- DROP TABLE IF EXISTS denis_staff_notifications;

-- ===== 00137_denis_staff_notifications_realtime.sql =====
-- Realtime for Denis staff notifications (in-app bell)

ALTER TABLE denis_staff_notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'denis_staff_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE denis_staff_notifications;
  END IF;
END $$;

-- Rollback:
-- ALTER PUBLICATION supabase_realtime DROP TABLE denis_staff_notifications;

-- ===== 00138_learned_basket_pairs.sql =====
-- G1: Learned basket pairs — co-occurrence from delivered orders per table session

ALTER TABLE location_rhythm_priors
  ADD COLUMN IF NOT EXISTS learned_basket_pairs JSONB NOT NULL DEFAULT '{"version":1,"pairs":[]}'::jsonb;

COMMENT ON COLUMN location_rhythm_priors.learned_basket_pairs IS
  'G1: venue-specific product co-occurrence pairs (weekly rollup, min 10 sessions)';

-- ===== 00139_denis_event_config.sql =====
-- N3 — Denis event mode config (staff-set, JSON document per location)
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS denis_event_config JSONB;

COMMENT ON COLUMN locations.denis_event_config IS
  'Active private event profile when denis_operating_mode = event';

-- Mark migrations applied
INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('00126', '00126_guest_memory_dessert_skip.sql', ARRAY[]::text[]) ON CONFLICT (version) DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('00127', '00127_denis_live_ab_experiments.sql', ARRAY[]::text[]) ON CONFLICT (version) DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('00128', '00128_commerce_preorders.sql', ARRAY[]::text[]) ON CONFLICT (version) DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('00129', '00129_guest_memory_review_funnel.sql', ARRAY[]::text[]) ON CONFLICT (version) DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('00130', '00130_guest_engagement_retention.sql', ARRAY[]::text[]) ON CONFLICT (version) DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('00131', '00131_denis_audit_trail.sql', ARRAY[]::text[]) ON CONFLICT (version) DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('00132', '00132_denis_turn_traces.sql', ARRAY[]::text[]) ON CONFLICT (version) DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('00133', '00133_health_audit_indexes.sql', ARRAY[]::text[]) ON CONFLICT (version) DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('00134', '00134_experience_analytics_roi.sql', ARRAY[]::text[]) ON CONFLICT (version) DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('00135', '00135_experience_score.sql', ARRAY[]::text[]) ON CONFLICT (version) DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('00136', '00136_denis_staff_notifications.sql', ARRAY[]::text[]) ON CONFLICT (version) DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('00137', '00137_denis_staff_notifications_realtime.sql', ARRAY[]::text[]) ON CONFLICT (version) DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('00138', '00138_learned_basket_pairs.sql', ARRAY[]::text[]) ON CONFLICT (version) DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('00139', '00139_denis_event_config.sql', ARRAY[]::text[]) ON CONFLICT (version) DO NOTHING;
COMMIT;

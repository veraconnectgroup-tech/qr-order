-- Guest Conduct Policy Engine — permanent-rule-vs-one-time-exception state
-- machine (proposed -> pending_confirmation -> confirmed, or
-- rejected/expired). Founder's own decision (2026-07-12): a colleague's
-- answer is never enough on its own to durably change house knowledge —
-- it always needs owner/manager confirmation. Denis MAY apply it
-- immediately for the current order (a one-time application, logged to
-- denis_timeline as rule.applied_once, never written here), but the
-- durable write only happens once an owner/manager confirms — and Denis
-- should feel free to bring a pending item up naturally next time he
-- talks to the owner, not just wait for a dashboard click.
--
-- Existing rows default to status='confirmed'/scope='permanent' — nothing
-- about today's restaurant-knowledge behavior changes until code starts
-- writing 'proposed'/'pending_confirmation' rows (not yet — see
-- docs/testing-todo.md and the Guest Conduct Policy Engine plan §7/§16).

ALTER TABLE denis_restaurant_knowledge
  ADD COLUMN status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('proposed', 'pending_confirmation', 'confirmed', 'rejected', 'expired')),
  ADD COLUMN scope TEXT NOT NULL DEFAULT 'permanent'
    CHECK (scope IN ('permanent', 'one_time')),
  ADD COLUMN proposed_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  ADD COLUMN confirmed_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  ADD COLUMN confirmed_at TIMESTAMPTZ,
  ADD COLUMN source_ai_session_id UUID REFERENCES ai_sessions(id) ON DELETE SET NULL,
  ADD COLUMN source_mission_id UUID REFERENCES denis_missions(id) ON DELETE SET NULL,
  ADD COLUMN pending_expires_at TIMESTAMPTZ;

CREATE INDEX idx_denis_restaurant_knowledge_pending
  ON denis_restaurant_knowledge (location_id, pending_expires_at)
  WHERE status = 'pending_confirmation';

COMMENT ON COLUMN denis_restaurant_knowledge.status IS
  'proposed: Denis extracted a rule candidate from a staff answer, not yet actionable as durable knowledge. pending_confirmation: awaiting owner/manager sign-off. confirmed: active, read by assembleDenisBrainContext. rejected/expired: terminal, never surfaced.';

COMMENT ON COLUMN denis_restaurant_knowledge.scope IS
  'permanent: intended as a standing house rule. one_time: an exception for a specific situation, never promoted to a durable rule regardless of confirmation status.';

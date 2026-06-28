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

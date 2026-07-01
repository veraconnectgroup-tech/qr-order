-- Guest SMS / WhatsApp notification preferences (Prompt 89 — GDPR opt-in per channel).

CREATE TABLE IF NOT EXISTS guest_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  phone_e164 TEXT,
  preferred_channel TEXT CHECK (
    preferred_channel IN ('push', 'whatsapp', 'sms', 'email')
  ),
  sms_consent_at TIMESTAMPTZ,
  whatsapp_consent_at TIMESTAMPTZ,
  transactional_consent_at TIMESTAMPTZ,
  marketing_consent_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  retention_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, device_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_guest_notification_prefs_location
  ON guest_notification_preferences (location_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_guest_notification_prefs_phone
  ON guest_notification_preferences (phone_e164)
  WHERE phone_e164 IS NOT NULL;

CREATE TABLE IF NOT EXISTS guest_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  device_fingerprint TEXT,
  phone_e164 TEXT,
  channel TEXT NOT NULL CHECK (channel IN ('push', 'whatsapp', 'sms', 'email')),
  kind TEXT NOT NULL CHECK (kind IN ('transactional', 'marketing')),
  template_id TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guest_notification_log_location_sent
  ON guest_notification_log (location_id, sent_at DESC);

ALTER TABLE guest_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY guest_notification_prefs_staff ON guest_notification_preferences
  FOR SELECT USING (location_id = ANY(get_user_location_ids()));

CREATE POLICY guest_notification_log_staff ON guest_notification_log
  FOR SELECT USING (location_id = ANY(get_user_location_ids()));

COMMENT ON TABLE guest_notification_preferences IS
  'Prompt 89 — per-channel opt-in, preferred channel, STOP unsubscribe, retention expiry';
COMMENT ON TABLE guest_notification_log IS
  'Prompt 89 — audit trail for outbound guest SMS/WhatsApp/push';

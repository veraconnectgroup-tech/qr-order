-- Denis station-to-station relay messages
-- Staff on a "Pozovi Denisa" call can ask Denis to relay something to the
-- other station (kitchen <-> bar), or Denis can decide to on his own during
-- the conversation. One row carries the whole round-trip: the message is
-- delivered (spoken) at the target station, the reply is captured as free
-- text (not the strict order-status enum station_questions uses, since this
-- isn't about an order), then the reply is delivered back to the station
-- that asked. origin_notified_at marks the second delivery so it's only
-- spoken once.

CREATE TABLE denis_station_relay_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  from_station TEXT NOT NULL CHECK (from_station IN ('kitchen', 'bar')),
  to_station TEXT NOT NULL CHECK (to_station IN ('kitchen', 'bar')),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'answered', 'expired', 'cancelled')
  ),
  reply TEXT,
  requested_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  replied_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  asked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  replied_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  origin_notified_at TIMESTAMPTZ,
  CONSTRAINT denis_station_relay_messages_different_stations
    CHECK (from_station <> to_station)
);

CREATE INDEX idx_denis_station_relay_open
  ON denis_station_relay_messages (location_id, to_station, asked_at)
  WHERE status = 'open';

CREATE INDEX idx_denis_station_relay_undelivered_reply
  ON denis_station_relay_messages (location_id, from_station, replied_at)
  WHERE status = 'answered' AND origin_notified_at IS NULL;

ALTER TABLE denis_station_relay_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_denis_station_relay_messages" ON denis_station_relay_messages
  FOR ALL USING (location_id = ANY(get_user_location_ids()));

CREATE POLICY "service_role_denis_station_relay_messages" ON denis_station_relay_messages
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE denis_station_relay_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'denis_station_relay_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE denis_station_relay_messages;
  END IF;
END $$;

COMMENT ON TABLE denis_station_relay_messages IS
  'Denis relaying a free-text message + reply between kitchen and bar, voice-initiated.';

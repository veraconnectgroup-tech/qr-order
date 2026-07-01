-- Denis ↔ Kitchen/Bar Question Card (P0)
-- Denis never invents ETAs — he asks the station and relays the one-tap answer.

CREATE TABLE station_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
  station TEXT NOT NULL CHECK (station IN ('kitchen', 'bar')),
  question_type TEXT NOT NULL CHECK (
    question_type IN ('eta', 'pending_accept', 'ready_pickup', 'mixed_conflict')
  ),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'answered', 'expired', 'cancelled')
  ),
  answer TEXT CHECK (
    answer IN ('eta', 'ready', 'problem', 'accepted', 'picked_up', 'still_waiting')
  ),
  answer_eta_minutes INTEGER CHECK (
    answer_eta_minutes > 0 AND answer_eta_minutes <= 120
  ),
  answered_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  asked_by TEXT NOT NULL CHECK (asked_by IN ('denis', 'manager', 'guest_trigger')),
  source_event TEXT,
  asked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  answered_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_station_questions_open
  ON station_questions (location_id, station, asked_at)
  WHERE status = 'open';

CREATE INDEX idx_station_questions_order
  ON station_questions (order_id, station, asked_at DESC);

ALTER TABLE station_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_station_questions" ON station_questions
  FOR ALL USING (location_id = ANY(get_user_location_ids()));

CREATE POLICY "service_role_station_questions" ON station_questions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Realtime for KDS/bar strips
ALTER TABLE station_questions REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'station_questions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE station_questions;
  END IF;
END $$;

COMMENT ON TABLE station_questions IS
  'Denis → kitchen/bar question cards with one-tap answers (truthful ETA loop).';

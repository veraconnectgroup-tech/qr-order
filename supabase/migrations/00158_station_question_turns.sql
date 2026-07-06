-- Persistent Denis ↔ staff voice conversation turns per station question card.

CREATE TABLE station_question_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_question_id UUID NOT NULL REFERENCES station_questions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('denis', 'staff')),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_station_question_turns_question
  ON station_question_turns (station_question_id, created_at);

ALTER TABLE station_question_turns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_station_question_turns" ON station_question_turns
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM station_questions sq
      WHERE sq.id = station_question_turns.station_question_id
        AND sq.location_id = ANY(get_user_location_ids())
    )
  );

CREATE POLICY "service_role_station_question_turns" ON station_question_turns
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE station_question_turns IS
  'Append-only voice conversation log for Denis station question cards (survives refresh).';

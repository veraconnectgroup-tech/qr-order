-- Denis's running sense of how each staff member treats him — separate from
-- the raw station_question_turns conversation log, this tracks a per-person
-- warmth signal so his tone can adapt (warmer to kind staff, drier/more
-- clipped — never actually rude — to dismissive ones).

CREATE TABLE denis_relationship_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  warmth_score NUMERIC(4, 3) NOT NULL DEFAULT 0,
  interaction_count INTEGER NOT NULL DEFAULT 0,
  last_tone TEXT NOT NULL DEFAULT 'neutral' CHECK (last_tone IN ('warm', 'neutral', 'curt')),
  last_sample TEXT,
  last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, staff_id)
);

CREATE INDEX idx_denis_relationship_signals_location
  ON denis_relationship_signals (location_id);

ALTER TABLE denis_relationship_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_denis_relationship_signals" ON denis_relationship_signals
  FOR ALL USING (
    location_id = ANY(get_user_location_ids())
  );

CREATE POLICY "service_role_denis_relationship_signals" ON denis_relationship_signals
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE denis_relationship_signals IS
  'Per-staff-member running warmth signal — how this person tends to treat Denis, used to gently shade his tone toward them. Never used to withhold help or escalate conflict.';

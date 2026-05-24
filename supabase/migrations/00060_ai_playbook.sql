-- AI Playbook: house rules + few-shot examples per location/org

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS ai_playbook TEXT;

CREATE TABLE IF NOT EXISTS ai_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN ('order', 'recommend', 'clarify', 'confirm', 'general')),
  user_message TEXT NOT NULL,
  assistant_message TEXT NOT NULL,
  assistant_json JSONB,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_examples_location
  ON ai_examples (location_id, sort_order)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_ai_examples_org
  ON ai_examples (org_id, sort_order)
  WHERE is_active = true AND location_id IS NULL;

ALTER TABLE ai_examples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_ai_examples" ON ai_examples
  FOR SELECT
  USING (org_id = ANY(get_user_org_ids()));

CREATE POLICY "staff_insert_ai_examples" ON ai_examples
  FOR INSERT
  WITH CHECK (org_id = ANY(get_user_org_ids()));

CREATE POLICY "staff_update_ai_examples" ON ai_examples
  FOR UPDATE
  USING (org_id = ANY(get_user_org_ids()))
  WITH CHECK (org_id = ANY(get_user_org_ids()));

CREATE POLICY "staff_delete_ai_examples" ON ai_examples
  FOR DELETE
  USING (org_id = ANY(get_user_org_ids()));

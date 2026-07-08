-- ADR-045 Restaurant tier — owner-authored durable house knowledge (facts,
-- rules, style) that Denis should always have, distinct from per-table
-- staff hints (ephemeral) and guest memory (per-guest). Free text.

CREATE TABLE IF NOT EXISTS denis_restaurant_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (length(trim(text)) >= 1 AND length(text) <= 500),
  source TEXT NOT NULL DEFAULT 'admin_text'
    CHECK (source IN ('admin_text', 'owner_voice')),
  created_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_denis_restaurant_knowledge_active
  ON denis_restaurant_knowledge (location_id, created_at DESC)
  WHERE archived_at IS NULL;

ALTER TABLE denis_restaurant_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_denis_restaurant_knowledge ON denis_restaurant_knowledge
  FOR ALL
  USING (auth.role() = 'service_role');

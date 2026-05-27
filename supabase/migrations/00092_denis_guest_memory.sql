-- M17: Consented guest memory (ADR-005 §7.2) — server-side, TTL, GDPR delete

CREATE TABLE IF NOT EXISTS denis_guest_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  guest_token TEXT NOT NULL,
  consent_scopes TEXT[] NOT NULL DEFAULT '{}',
  consented_at TIMESTAMPTZ,
  favorite_product_ids UUID[] NOT NULL DEFAULT '{}',
  last_visit_item_names TEXT[] NOT NULL DEFAULT '{}',
  allergy_labels TEXT[] NOT NULL DEFAULT '{}',
  allergy_sheet_ids TEXT[] NOT NULL DEFAULT '{}',
  preferred_language TEXT,
  visit_count INT NOT NULL DEFAULT 0 CHECK (visit_count >= 0),
  last_visit_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, guest_token)
);

CREATE INDEX IF NOT EXISTS idx_denis_guest_memory_location_expires
  ON denis_guest_memory (location_id, expires_at);

ALTER TABLE denis_guest_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_denis_guest_memory" ON denis_guest_memory
  FOR ALL
  USING (location_id = ANY(get_user_location_ids()))
  WITH CHECK (location_id = ANY(get_user_location_ids()));

COMMENT ON TABLE denis_guest_memory IS
  'Consented return-guest prefs — opaque guest_token, TTL, GDPR delete (ADR-005 §7.2)';

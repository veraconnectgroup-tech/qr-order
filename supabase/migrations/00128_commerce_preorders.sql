-- P3 — scheduled preorders (ADR-014 F6 spine)

CREATE TABLE commerce_preorders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
  guest_id TEXT NOT NULL,
  session_id UUID REFERENCES table_sessions(id) ON DELETE SET NULL,
  items JSONB NOT NULL DEFAULT '[]',
  scheduled_for TIMESTAMPTZ NOT NULL,
  kitchen_release_at TIMESTAMPTZ NOT NULL,
  no_show_cancel_at TIMESTAMPTZ NOT NULL,
  note TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('online', 'on_arrival')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'cancelled')),
  prep_time_minutes INT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, idempotency_key)
);

CREATE INDEX idx_commerce_preorders_location_scheduled
  ON commerce_preorders (location_id, scheduled_for);

CREATE INDEX idx_commerce_preorders_status_release
  ON commerce_preorders (status, kitchen_release_at);

ALTER TABLE commerce_preorders ENABLE ROW LEVEL SECURITY;

CREATE POLICY commerce_preorders_org_read ON commerce_preorders
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM staff
      WHERE user_id = auth.uid() AND is_active = true AND deleted_at IS NULL
    )
  );

COMMENT ON TABLE commerce_preorders IS
  'ADR-014 P3 — guest scheduled preorders; kitchen release via QStash job';

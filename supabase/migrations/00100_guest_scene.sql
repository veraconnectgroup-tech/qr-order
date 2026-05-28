-- ADR-016 SC-2: Guest Scene projection (versioned UI contract)

CREATE TABLE guest_scene (
  session_id UUID PRIMARY KEY REFERENCES table_sessions(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  version BIGINT NOT NULL DEFAULT 1 CHECK (version >= 1),
  scene JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_guest_scene_location_updated
  ON guest_scene (location_id, updated_at DESC);

COMMENT ON TABLE guest_scene IS
  'ADR-016 CQRS read model: versioned Scene JSON for guest + dashboard tile views. Rebuilt via scene.refresh outbox.';

ALTER TABLE guest_scene ENABLE ROW LEVEL SECURITY;

CREATE POLICY guest_scene_org_read ON guest_scene
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM staff
      WHERE user_id = auth.uid() AND is_active = true AND deleted_at IS NULL
    )
  );

-- scene.refresh uses existing session domain on outbox_events (no domain constraint change)

COMMENT ON COLUMN guest_scene.scene IS
  'Serialized Scene (version, phase, chrome, layers[]) — see src/lib/scene/types.ts';

-- ROLLBACK (manual):
-- DROP POLICY IF EXISTS guest_scene_org_read ON guest_scene;
-- DROP TABLE IF EXISTS guest_scene;

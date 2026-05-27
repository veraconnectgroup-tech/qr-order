-- M12: Denis party model — multi-device table, shared cart draft

ALTER TABLE table_sessions
  ADD COLUMN IF NOT EXISTS denis_shared_ai_session_id UUID REFERENCES ai_sessions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS denis_party_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_session_id UUID NOT NULL REFERENCES table_sessions(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL CHECK (length(device_fingerprint) >= 8),
  ai_session_id UUID REFERENCES ai_sessions(id) ON DELETE SET NULL,
  display_name TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  manual_cart_snapshot JSONB,
  manual_cart_revision INTEGER NOT NULL DEFAULT 0,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (table_session_id, device_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_denis_party_devices_session
  ON denis_party_devices (table_session_id, last_active_at DESC);

ALTER TABLE denis_party_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_denis_party_devices ON denis_party_devices
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION upsert_denis_party_device(
  p_table_session_id UUID,
  p_location_id UUID,
  p_table_id UUID,
  p_device_fingerprint TEXT,
  p_ai_session_id UUID DEFAULT NULL,
  p_manual_cart_snapshot JSONB DEFAULT NULL,
  p_manual_cart_revision INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_device denis_party_devices%ROWTYPE;
  v_primary_count INTEGER;
  v_shared_id UUID;
BEGIN
  IF p_device_fingerprint IS NULL OR length(p_device_fingerprint) < 8 THEN
    RAISE EXCEPTION 'invalid_device_fingerprint';
  END IF;

  INSERT INTO denis_party_devices (
    table_session_id,
    location_id,
    table_id,
    device_fingerprint,
    ai_session_id,
    manual_cart_snapshot,
    manual_cart_revision,
    last_active_at,
    is_primary
  ) VALUES (
    p_table_session_id,
    p_location_id,
    p_table_id,
    p_device_fingerprint,
    p_ai_session_id,
    p_manual_cart_snapshot,
    COALESCE(p_manual_cart_revision, 0),
    now(),
    false
  )
  ON CONFLICT (table_session_id, device_fingerprint) DO UPDATE SET
    ai_session_id = COALESCE(EXCLUDED.ai_session_id, denis_party_devices.ai_session_id),
    manual_cart_snapshot = COALESCE(
      EXCLUDED.manual_cart_snapshot,
      denis_party_devices.manual_cart_snapshot
    ),
    manual_cart_revision = GREATEST(
      denis_party_devices.manual_cart_revision,
      COALESCE(EXCLUDED.manual_cart_revision, 0)
    ),
    last_active_at = now()
  RETURNING * INTO v_device;

  SELECT COUNT(*) INTO v_primary_count
  FROM denis_party_devices
  WHERE table_session_id = p_table_session_id AND is_primary = true;

  IF v_primary_count = 0 THEN
    UPDATE denis_party_devices
    SET is_primary = true
    WHERE id = v_device.id
    RETURNING * INTO v_device;
  END IF;

  SELECT denis_shared_ai_session_id INTO v_shared_id
  FROM table_sessions
  WHERE id = p_table_session_id;

  IF v_shared_id IS NULL AND p_ai_session_id IS NOT NULL THEN
    UPDATE table_sessions
    SET denis_shared_ai_session_id = p_ai_session_id
    WHERE id = p_table_session_id;
    v_shared_id := p_ai_session_id;
  END IF;

  RETURN jsonb_build_object(
    'device_id', v_device.id,
    'is_primary', v_device.is_primary,
    'shared_ai_session_id', v_shared_id
  );
END;
$$;

-- Multi-location staff access: many-to-many staff ↔ locations.

CREATE TABLE staff_locations (
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  PRIMARY KEY (staff_id, location_id)
);

CREATE INDEX idx_staff_locations_location_id ON staff_locations (location_id);

INSERT INTO staff_locations (staff_id, location_id)
SELECT id, location_id FROM staff WHERE location_id IS NOT NULL;

ALTER TABLE staff_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_own_locations" ON staff_locations
  FOR SELECT USING (
    staff_id IN (
      SELECT id FROM staff
      WHERE user_id = auth.uid()
        AND is_active = true
        AND deleted_at IS NULL
    )
  );

CREATE POLICY "owner_manage_staff_locations" ON staff_locations
  FOR ALL USING (
    staff_id IN (
      SELECT s.id FROM staff s
      WHERE s.user_id = auth.uid()
        AND s.role = 'owner'
        AND s.is_active = true
        AND s.deleted_at IS NULL
    )
  );

-- Resolve accessible locations: explicit assignments, legacy location_id, or all org locations.
CREATE OR REPLACE FUNCTION get_user_location_ids()
RETURNS UUID[] AS $$
  SELECT COALESCE(
    NULLIF(
      ARRAY(
        SELECT DISTINCT sl.location_id
        FROM staff s
        JOIN staff_locations sl ON sl.staff_id = s.id
        JOIN locations l ON l.id = sl.location_id AND l.is_active = true
        WHERE s.user_id = auth.uid()
          AND s.is_active = true
          AND s.deleted_at IS NULL
      ),
      '{}'::uuid[]
    ),
    ARRAY(
      SELECT l.id
      FROM staff s
      JOIN locations l ON l.org_id = s.org_id AND l.is_active = true
      WHERE s.user_id = auth.uid()
        AND s.is_active = true
        AND s.deleted_at IS NULL
        AND (
          s.location_id IS NULL
          OR l.id = s.location_id
        )
    )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

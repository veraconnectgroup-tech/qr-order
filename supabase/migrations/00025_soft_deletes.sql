-- Soft deletes
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_products_active
  ON products (location_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_categories_active
  ON categories (location_id)
  WHERE deleted_at IS NULL;

-- Guest read policies: hide soft-deleted rows
DROP POLICY IF EXISTS "public_read_tables" ON tables;
CREATE POLICY "public_read_tables" ON tables
  FOR SELECT USING (is_active = true AND deleted_at IS NULL);

DROP POLICY IF EXISTS "public_read_categories" ON categories;
CREATE POLICY "public_read_categories" ON categories
  FOR SELECT USING (is_active = true AND deleted_at IS NULL);

DROP POLICY IF EXISTS "public_read_products" ON products;
CREATE POLICY "public_read_products" ON products
  FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "staff_read_staff" ON staff;
CREATE POLICY "staff_read_staff" ON staff
  FOR SELECT USING (org_id = ANY(get_user_org_ids()) AND deleted_at IS NULL);

CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS UUID[] AS $$
  SELECT ARRAY(
    SELECT org_id
    FROM staff
    WHERE user_id = auth.uid()
      AND is_active = true
      AND deleted_at IS NULL
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_location_ids()
RETURNS UUID[] AS $$
  SELECT ARRAY(
    SELECT COALESCE(s.location_id, l.id)
    FROM staff s
    LEFT JOIN locations l ON l.org_id = s.org_id
    WHERE s.user_id = auth.uid()
      AND s.is_active = true
      AND s.deleted_at IS NULL
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Order audit trigger
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO audit_log (action, order_id, metadata)
    VALUES (
      'status_change',
      NEW.id,
      jsonb_build_object(
        'from', OLD.status,
        'to', NEW.status,
        'changed_at', now()
      )
    );
  END IF;

  IF OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
    INSERT INTO audit_log (action, order_id, metadata)
    VALUES (
      'payment_change',
      NEW.id,
      jsonb_build_object(
        'from', OLD.payment_status,
        'to', NEW.payment_status,
        'changed_at', now()
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_order_audit ON orders;
CREATE TRIGGER trg_order_audit
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION log_order_status_change();

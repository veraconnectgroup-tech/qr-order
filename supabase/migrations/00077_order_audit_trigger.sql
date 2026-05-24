-- Fix: update order audit trigger to use new audit_log schema (G3)
-- The old trigger from 00025 inserted into audit_log(action, order_id, metadata)
-- but 00074 replaced audit_log with a new schema (org_id, entity_type, entity_id, etc.)

CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Get org_id via location
  SELECT l.org_id INTO v_org_id
  FROM locations l
  WHERE l.id = NEW.location_id;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO audit_log (org_id, action, entity_type, entity_id, old_value, new_value)
    VALUES (
      v_org_id,
      'update',
      'order.status',
      NEW.id::TEXT,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status)
    );
  END IF;

  IF OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
    INSERT INTO audit_log (org_id, action, entity_type, entity_id, old_value, new_value)
    VALUES (
      v_org_id,
      'update',
      'order.payment_status',
      NEW.id::TEXT,
      jsonb_build_object('payment_status', OLD.payment_status),
      jsonb_build_object('payment_status', NEW.payment_status)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- FC-5: Block fiscal field updates after TSE sign (KassenSichV / GoBD)

CREATE OR REPLACE FUNCTION guard_order_fiscal_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.tse_signature IS NOT NULL THEN
    IF NEW.subtotal IS DISTINCT FROM OLD.subtotal
       OR NEW.tax_amount IS DISTINCT FROM OLD.tax_amount
       OR NEW.total IS DISTINCT FROM OLD.total
       OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
       OR NEW.tse_signature IS DISTINCT FROM OLD.tse_signature
       OR NEW.tse_data IS DISTINCT FROM OLD.tse_data THEN
      RAISE EXCEPTION 'fiscal_immutable: order % signed by TSE', OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_fiscal_immutable ON orders;
CREATE TRIGGER trg_orders_fiscal_immutable
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION guard_order_fiscal_immutability();

CREATE OR REPLACE FUNCTION guard_order_item_fiscal_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_signed BOOLEAN;
BEGIN
  SELECT (o.tse_signature IS NOT NULL)
  INTO v_signed
  FROM orders o
  WHERE o.id = COALESCE(NEW.order_id, OLD.order_id);

  IF v_signed THEN
    RAISE EXCEPTION 'fiscal_immutable: order item locked — parent order TSE signed';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_items_fiscal_immutable ON order_items;
CREATE TRIGGER trg_order_items_fiscal_immutable
  BEFORE UPDATE OR DELETE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION guard_order_item_fiscal_immutability();

DROP TRIGGER IF EXISTS trg_order_items_fiscal_immutable_insert ON order_items;
CREATE TRIGGER trg_order_items_fiscal_immutable_insert
  BEFORE INSERT ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION guard_order_item_fiscal_immutability();

COMMENT ON FUNCTION guard_order_fiscal_immutability IS
  'FC-5: prevents mutating fiscal amounts on TSE-signed orders';

-- Rollback:
-- DROP TRIGGER IF EXISTS trg_order_items_fiscal_immutable_insert ON order_items;
-- DROP TRIGGER IF EXISTS trg_order_items_fiscal_immutable ON order_items;
-- DROP TRIGGER IF EXISTS trg_orders_fiscal_immutable ON orders;
-- DROP FUNCTION IF EXISTS guard_order_item_fiscal_immutability();
-- DROP FUNCTION IF EXISTS guard_order_fiscal_immutability();

-- ADR-043 S1: per-station order truth (kitchen / bar) without rewriting orders.status flow.

CREATE TABLE order_station_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  station TEXT NOT NULL CHECK (station IN ('kitchen', 'bar')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'in_prep', 'ready', 'picked_up', 'served', 'cancelled')
  ),
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  in_prep_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  served_at TIMESTAMPTZ,
  updated_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  UNIQUE (order_id, station)
);

CREATE INDEX idx_order_station_states_order_id
  ON order_station_states (order_id);

CREATE INDEX idx_order_station_states_location_active
  ON order_station_states (location_id, status)
  WHERE status IN ('ready', 'in_prep');

ALTER TABLE order_station_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_order_station_states" ON order_station_states
  FOR ALL USING (location_id = ANY(get_user_location_ids()));

CREATE POLICY "service_role_order_station_states" ON order_station_states
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE order_station_states REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'order_station_states'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE order_station_states;
  END IF;
END $$;

COMMENT ON TABLE order_station_states IS
  'Per-station lifecycle for mixed orders (kitchen/bar). Global orders.status stays for fiscal/guest.';

-- ---------------------------------------------------------------------------
-- Station mapping helpers
-- menu_section: food/desserts -> kitchen, drinks -> bar
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION menu_section_to_station(p_menu_section TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_menu_section IN ('food', 'desserts') THEN 'kitchen'
    WHEN p_menu_section = 'drinks' THEN 'bar'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION order_has_station_items(
  p_order_id UUID,
  p_station TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM order_items oi
    WHERE oi.order_id = p_order_id
      AND menu_section_to_station(oi.menu_section) = p_station
  );
$$;

-- ---------------------------------------------------------------------------
-- AFTER INSERT on order_items — create station row or reopen round after served
--
-- Examples (mixed order pivo + cevapi):
--   INSERT drink  -> bar row queued
--   INSERT food   -> kitchen row queued
-- Round 2 after bar served:
--   INSERT drink  -> bar row reset queued (ready_at/picked_up_at/served_at cleared)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION sync_order_station_state_on_item_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_station TEXT;
  v_location_id UUID;
BEGIN
  v_station := menu_section_to_station(NEW.menu_section);
  IF v_station IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT o.location_id
  INTO v_location_id
  FROM orders o
  WHERE o.id = NEW.order_id;

  IF v_location_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO order_station_states (order_id, location_id, station, status, queued_at)
  VALUES (NEW.order_id, v_location_id, v_station, 'queued', now())
  ON CONFLICT (order_id, station) DO UPDATE SET
    status = CASE
      WHEN order_station_states.status IN ('picked_up', 'served') THEN 'queued'
      ELSE order_station_states.status
    END,
    queued_at = CASE
      WHEN order_station_states.status IN ('picked_up', 'served') THEN now()
      ELSE order_station_states.queued_at
    END,
    in_prep_at = CASE
      WHEN order_station_states.status IN ('picked_up', 'served') THEN NULL
      ELSE order_station_states.in_prep_at
    END,
    ready_at = CASE
      WHEN order_station_states.status IN ('picked_up', 'served') THEN NULL
      ELSE order_station_states.ready_at
    END,
    picked_up_at = CASE
      WHEN order_station_states.status IN ('picked_up', 'served') THEN NULL
      ELSE order_station_states.picked_up_at
    END,
    served_at = CASE
      WHEN order_station_states.status IN ('picked_up', 'served') THEN NULL
      ELSE order_station_states.served_at
    END,
    updated_by = CASE
      WHEN order_station_states.status IN ('picked_up', 'served') THEN NULL
      ELSE order_station_states.updated_by
    END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_items_sync_station_state_insert ON order_items;
CREATE TRIGGER trg_order_items_sync_station_state_insert
  AFTER INSERT ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION sync_order_station_state_on_item_insert();

-- ---------------------------------------------------------------------------
-- AFTER DELETE on order_items — cancel station when last item for station removed
-- Gap: TSE-signed orders block DELETE via guard_order_item_fiscal_immutability;
-- void/comp flows that only mark order cancelled are covered by orders.status trigger.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION sync_order_station_state_on_item_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_station TEXT;
BEGIN
  v_station := menu_section_to_station(OLD.menu_section);
  IF v_station IS NULL THEN
    RETURN OLD;
  END IF;

  IF NOT order_has_station_items(OLD.order_id, v_station) THEN
    UPDATE order_station_states
    SET status = 'cancelled',
        updated_by = NULL
    WHERE order_id = OLD.order_id
      AND station = v_station
      AND status <> 'cancelled';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_items_sync_station_state_delete ON order_items;
CREATE TRIGGER trg_order_items_sync_station_state_delete
  AFTER DELETE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION sync_order_station_state_on_item_delete();

-- ---------------------------------------------------------------------------
-- Cancel/reject order -> all station rows cancelled (aggregation never revives)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION sync_order_station_states_on_order_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('cancelled', 'rejected')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE order_station_states
    SET status = 'cancelled',
        updated_by = NULL
    WHERE order_id = NEW.id
      AND status <> 'cancelled';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_sync_station_states_status ON orders;
CREATE TRIGGER trg_orders_sync_station_states_status
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION sync_order_station_states_on_order_status();

-- ---------------------------------------------------------------------------
-- Backfill active orders (skip delivered / cancelled / rejected)
-- ---------------------------------------------------------------------------

INSERT INTO order_station_states (
  order_id,
  location_id,
  station,
  status,
  queued_at,
  in_prep_at,
  ready_at
)
SELECT
  grouped.order_id,
  grouped.location_id,
  grouped.station,
  CASE
    WHEN grouped.order_status = 'preparing' THEN 'in_prep'
    WHEN grouped.order_status = 'ready' THEN 'ready'
    ELSE 'queued'
  END,
  grouped.created_at,
  CASE
    WHEN grouped.order_status = 'preparing' THEN COALESCE(grouped.preparing_at, grouped.created_at)
    ELSE NULL
  END,
  CASE
    WHEN grouped.order_status = 'ready' THEN COALESCE(grouped.ready_at, grouped.created_at)
    ELSE NULL
  END
FROM (
  SELECT
    o.id AS order_id,
    o.location_id,
    o.status AS order_status,
    o.created_at,
    o.preparing_at,
    o.ready_at,
    menu_section_to_station(oi.menu_section) AS station
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  WHERE o.status NOT IN ('delivered', 'cancelled', 'rejected')
    AND menu_section_to_station(oi.menu_section) IS NOT NULL
  GROUP BY
    o.id,
    o.location_id,
    o.status,
    o.created_at,
    o.preparing_at,
    o.ready_at,
    menu_section_to_station(oi.menu_section)
) grouped
ON CONFLICT (order_id, station) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Global status aggregation (ADR-043 §4.2) — never backward
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION order_status_rank(p_status TEXT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_status
    WHEN 'pending_approval' THEN 0
    WHEN 'pending' THEN 1
    WHEN 'accepted' THEN 2
    WHEN 'preparing' THEN 3
    WHEN 'ready' THEN 4
    WHEN 'delivered' THEN 5
    ELSE -1
  END;
$$;

CREATE OR REPLACE FUNCTION aggregate_order_status_from_stations(
  p_station_states TEXT[],
  p_current_status TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_active TEXT[];
  v_candidate TEXT;
BEGIN
  IF p_current_status IN ('cancelled', 'rejected') THEN
    RETURN p_current_status;
  END IF;

  v_active := ARRAY(
    SELECT s
    FROM unnest(p_station_states) AS s
    WHERE s IS NOT NULL AND s <> 'cancelled'
  );

  IF COALESCE(array_length(v_active, 1), 0) = 0 THEN
    RETURN p_current_status;
  END IF;

  IF EXISTS (SELECT 1 FROM unnest(v_active) s WHERE s = 'in_prep') THEN
    v_candidate := 'preparing';
  ELSIF NOT EXISTS (SELECT 1 FROM unnest(v_active) s WHERE s <> 'served') THEN
    v_candidate := 'delivered';
  ELSIF NOT EXISTS (
    SELECT 1
    FROM unnest(v_active) s
    WHERE s NOT IN ('ready', 'picked_up', 'served')
  ) THEN
    v_candidate := 'ready';
  ELSE
    RETURN p_current_status;
  END IF;

  IF order_status_rank(v_candidate) > order_status_rank(p_current_status) THEN
    RETURN v_candidate;
  END IF;

  RETURN p_current_status;
END;
$$;

CREATE OR REPLACE FUNCTION patch_station_status_tx(
  p_order_id UUID,
  p_station TEXT,
  p_status TEXT,
  p_staff_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_row order_station_states%ROWTYPE;
  v_now TIMESTAMPTZ := now();
  v_new_global TEXT;
  v_allowed BOOLEAN;
BEGIN
  IF p_station NOT IN ('kitchen', 'bar') THEN
    RAISE EXCEPTION 'invalid_station';
  END IF;

  IF p_status NOT IN ('queued', 'in_prep', 'ready', 'picked_up', 'served', 'cancelled') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  SELECT * INTO v_row
  FROM order_station_states
  WHERE order_id = p_order_id AND station = p_station
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'station_state_not_found';
  END IF;

  IF v_row.status = 'cancelled' OR v_order.status IN ('cancelled', 'rejected') THEN
    RAISE EXCEPTION 'station_state_locked';
  END IF;

  v_allowed := CASE v_row.status
    WHEN 'queued' THEN p_status IN ('in_prep', 'cancelled')
    WHEN 'in_prep' THEN p_status IN ('ready', 'cancelled')
    WHEN 'ready' THEN p_status IN ('picked_up', 'cancelled')
    WHEN 'picked_up' THEN p_status IN ('served', 'cancelled')
    WHEN 'served' THEN p_status = 'cancelled'
    ELSE false
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'invalid_transition';
  END IF;

  UPDATE order_station_states
  SET
    status = p_status,
    in_prep_at = CASE WHEN p_status = 'in_prep' AND in_prep_at IS NULL THEN v_now ELSE in_prep_at END,
    ready_at = CASE WHEN p_status = 'ready' AND ready_at IS NULL THEN v_now ELSE ready_at END,
    picked_up_at = CASE WHEN p_status = 'picked_up' AND picked_up_at IS NULL THEN v_now ELSE picked_up_at END,
    served_at = CASE WHEN p_status = 'served' AND served_at IS NULL THEN v_now ELSE served_at END,
    updated_by = p_staff_id
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  SELECT aggregate_order_status_from_stations(
    ARRAY(
      SELECT oss.status
      FROM order_station_states oss
      WHERE oss.order_id = p_order_id
    ),
    v_order.status
  )
  INTO v_new_global;

  IF v_new_global IS DISTINCT FROM v_order.status
     AND order_status_rank(v_new_global) > order_status_rank(v_order.status) THEN
    UPDATE orders
    SET
      status = v_new_global,
      preparing_at = CASE
        WHEN v_new_global = 'preparing' AND preparing_at IS NULL THEN v_now
        ELSE preparing_at
      END,
      ready_at = CASE
        WHEN v_new_global = 'ready' AND ready_at IS NULL THEN v_now
        ELSE ready_at
      END,
      delivered_at = CASE
        WHEN v_new_global = 'delivered' AND delivered_at IS NULL THEN v_now
        ELSE delivered_at
      END
    WHERE id = p_order_id
    RETURNING * INTO v_order;
  END IF;

  RETURN jsonb_build_object(
    'station_status', v_row.status,
    'global_status', v_order.status,
    'station', v_row.station,
    'order_id', p_order_id
  );
END;
$$;

COMMENT ON FUNCTION patch_station_status_tx IS
  'Atomic station status patch + global orders.status aggregation (ADR-043 §4.2).';

GRANT EXECUTE ON FUNCTION patch_station_status_tx(UUID, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION patch_station_status_tx(UUID, TEXT, TEXT, UUID) TO service_role;

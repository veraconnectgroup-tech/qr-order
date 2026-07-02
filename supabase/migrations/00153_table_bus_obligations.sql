-- ADR-043 S13 — table turnaround (bus) obligations after payment

CREATE TABLE table_bus_obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  session_id UUID REFERENCES table_sessions(id) ON DELETE SET NULL,
  assigned_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'bussed', 'cancelled')),
  paid_at TIMESTAMPTZ NOT NULL,
  bussed_at TIMESTAMPTZ,
  bussed_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  reminder_sent_at TIMESTAMPTZ,
  escalated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_table_bus_obligations_one_open_per_table
  ON table_bus_obligations (table_id)
  WHERE status = 'open';

CREATE INDEX idx_table_bus_obligations_location_open
  ON table_bus_obligations (location_id, paid_at)
  WHERE status = 'open';

CREATE INDEX idx_table_bus_obligations_turnaround
  ON table_bus_obligations (location_id, paid_at, bussed_at)
  WHERE status = 'bussed';

ALTER TABLE table_bus_obligations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_table_bus_obligations" ON table_bus_obligations
  FOR ALL USING (location_id = ANY(get_user_location_ids()));

CREATE POLICY "service_role_table_bus_obligations" ON table_bus_obligations
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE table_bus_obligations REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'table_bus_obligations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE table_bus_obligations;
  END IF;
END $$;

COMMENT ON TABLE table_bus_obligations IS
  'ADR-043 S13 — Denis bus-table obligation after session payment (table turnaround).';

-- Track D1: Star CloudPRNT printer support + print job queue

ALTER TABLE printer_configs
  DROP CONSTRAINT IF EXISTS printer_configs_type_check;

ALTER TABLE printer_configs
  ADD CONSTRAINT printer_configs_type_check
  CHECK (type IN ('usb', 'lan', 'cloud'));

ALTER TABLE printer_configs
  ADD COLUMN IF NOT EXISTS mac_address TEXT;

ALTER TABLE printer_configs
  DROP CONSTRAINT IF EXISTS printer_configs_check;

ALTER TABLE printer_configs
  ADD CONSTRAINT printer_configs_connection_check
  CHECK (
    (type = 'usb')
    OR (
      type = 'lan'
      AND ip_address IS NOT NULL
      AND port > 0
      AND port <= 65535
    )
    OR (type = 'cloud' AND mac_address IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_printer_configs_mac
  ON printer_configs (mac_address)
  WHERE mac_address IS NOT NULL
    AND type = 'cloud';

CREATE TABLE print_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  printer_id UUID NOT NULL
    REFERENCES printer_configs(id) ON DELETE CASCADE,
  location_id UUID NOT NULL
    REFERENCES locations(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id)
    ON DELETE SET NULL,
  job_type TEXT NOT NULL DEFAULT 'kitchen',
  payload BYTEA NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'printing', 'done', 'failed')),
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  picked_at TIMESTAMPTZ,
  done_at TIMESTAMPTZ
);

CREATE INDEX idx_print_jobs_pending
  ON print_jobs (printer_id, status)
  WHERE status = 'pending';

ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_select_print_jobs" ON print_jobs
  FOR SELECT
  USING (location_id = ANY(get_user_location_ids()));

COMMENT ON TABLE print_jobs IS
  'CloudPRNT print queue — ESC/POS payloads polled by Star cloud printers.';

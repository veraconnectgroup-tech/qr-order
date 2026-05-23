-- Internal write probe for /api/health/deep (service role only)

CREATE TABLE IF NOT EXISTS health_check (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  probe_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE health_check ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION health_ping()
RETURNS INT AS $$
  SELECT 1;
$$ LANGUAGE sql STABLE;

-- ADR-052 §I — SecretsManager. Today there is genuinely nothing for this:
-- platform-wide secrets are plain env vars (src/lib/env.ts), per-tenant POS
-- secrets are plain JSON in pos_integrations.config, protected only by
-- RLS/service-role access. That was acceptable for one hand-written
-- Deliverect adapter; it is not acceptable once Integration Builder can
-- hold credentials for many generated adapters, sandbox and production.
--
-- pgp_sym_encrypt/pgp_sym_decrypt (pgcrypto) with a key that lives ONLY in
-- an env var, never in the database — same "the encryption key is not a
-- database secret" boundary Stripe/other external services already get
-- via env.ts. LLM-generated adapter code never sees a real value: it only
-- ever receives a credentialRef (this row's id), resolved to the real
-- value inside the execution layer (sandbox-runner.ts / a future live
-- adapter caller), never inside code an LLM wrote or the agentic loop can
-- read directly.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE integration_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES integration_providers(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  -- SandboxRunner may only ever read environment='sandbox' rows — a
  -- generated adapter under test must be physically unable to read a
  -- production credential (ADR-052 §A step 7's autonomy line).
  environment TEXT NOT NULL CHECK (environment IN ('sandbox', 'production')),
  credential_type TEXT NOT NULL CHECK (credential_type IN (
    'api_key', 'basic_auth', 'oauth2_client_credentials', 'bearer_token',
    'hmac_secret', 'webhook_secret', 'mtls_cert'
  )),
  encrypted_value BYTEA NOT NULL,
  created_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_id, location_id, environment, credential_type)
);

CREATE INDEX idx_integration_credentials_lookup
  ON integration_credentials (provider_id, location_id, environment);

ALTER TABLE integration_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_integration_credentials" ON integration_credentials
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- SECURITY DEFINER so the encryption key never has to leave Postgres to
-- get compared/used — it's passed in as a parameter (from env.ts, the
-- caller) and used only inside this function's own execution. Both
-- functions are stripped from PUBLIC/anon/authenticated on purpose: only
-- the service-role admin client (server-side only) may ever call these,
-- same boundary as every other credential-touching path in this codebase.
CREATE OR REPLACE FUNCTION store_integration_credential(
  p_provider_id UUID,
  p_location_id UUID,
  p_environment TEXT,
  p_credential_type TEXT,
  p_value TEXT,
  p_encryption_key TEXT,
  p_created_by_staff_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO integration_credentials (
    provider_id, location_id, environment, credential_type,
    encrypted_value, created_by_staff_id
  ) VALUES (
    p_provider_id, p_location_id, p_environment, p_credential_type,
    pgp_sym_encrypt(p_value, p_encryption_key), p_created_by_staff_id
  )
  ON CONFLICT (provider_id, location_id, environment, credential_type)
  DO UPDATE SET
    encrypted_value = EXCLUDED.encrypted_value,
    created_by_staff_id = EXCLUDED.created_by_staff_id,
    created_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION read_integration_credential(
  p_id UUID,
  p_encryption_key TEXT
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value TEXT;
BEGIN
  SELECT pgp_sym_decrypt(encrypted_value, p_encryption_key) INTO v_value
  FROM integration_credentials
  WHERE id = p_id;
  RETURN v_value;
END;
$$;

REVOKE ALL ON FUNCTION store_integration_credential(UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION read_integration_credential(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION store_integration_credential(UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION read_integration_credential(UUID, TEXT) TO service_role;

COMMENT ON TABLE integration_credentials IS
  'ADR-052 §I SecretsManager. encrypted_value is pgp_sym_encrypt output — only store/read_integration_credential (SECURITY DEFINER, service_role-only) may write or decrypt it. Not yet written to by any live code path as of this migration.';

-- ADR-052 Phase 0 — Denis Integration Builder schema. Zero runtime behavior
-- change: no live code writes to these tables yet. This only unblocks
-- Phase 1+ (OpenAPI/Postman ingestion, adapter generation) without a
-- further migration once that work begins. Design doc: ADR-052.
--
-- Deliberately NOT included here (later phases per ADR-052 §7):
-- integration_test_runs/test_results (Phase 3), integration_credentials
-- (Phase 3, needs pgcrypto), integration_deployments (Phase 5),
-- integration_audit_events / integration_approval_requests (Phase 5).

CREATE TABLE integration_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(trim(name)) >= 1 AND length(name) <= 200),
  category TEXT NOT NULL CHECK (category IN ('pos', 'delivery', 'reservation', 'payment', 'accounting')),
  integration_kind TEXT NOT NULL DEFAULT 'api' CHECK (integration_kind IN ('api', 'browser_automation')),
  status TEXT NOT NULL DEFAULT 'not_built' CHECK (status IN ('not_built', 'not_connected', 'connected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE integration_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES integration_providers(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('openapi', 'postman', 'pdf', 'html', 'text')),
  raw_content TEXT,
  storage_url TEXT,
  uploaded_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  parse_status TEXT NOT NULL DEFAULT 'uploaded' CHECK (parse_status IN ('uploaded', 'parsed', 'failed')),
  CHECK (raw_content IS NOT NULL OR storage_url IS NOT NULL)
);

CREATE TABLE integration_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES integration_providers(id) ON DELETE CASCADE,
  capability TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN (
    'supported', 'supported_with_limitations', 'unsupported',
    'requires_direct_integration', 'requires_human_operation',
    'unknown', 'experimental'
  )),
  endpoint TEXT,
  required_permissions TEXT[] NOT NULL DEFAULT '{}',
  side_effect_level TEXT NOT NULL DEFAULT 'none' CHECK (side_effect_level IN ('none', 'mutating', 'financial', 'destructive')),
  confirmation_required BOOLEAN NOT NULL DEFAULT false,
  idempotency_support TEXT NOT NULL DEFAULT 'none' CHECK (idempotency_support IN ('native', 'denis_managed', 'none')),
  rate_limits JSONB,
  known_limitations TEXT[] NOT NULL DEFAULT '{}',
  quoted_span TEXT,
  test_status TEXT NOT NULL DEFAULT 'untested' CHECK (test_status IN ('untested', 'mock_tested', 'sandbox_tested', 'contract_verified')),
  certification_status TEXT NOT NULL DEFAULT 'draft' CHECK (certification_status IN (
    'draft', 'generated', 'sandbox_verified', 'human_reviewed', 'canary', 'certified', 'disabled'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Programmatic guarantee behind ADR-052 §3: a capability can never be
  -- recorded as usable without a citation back to the source document.
  CHECK (status NOT IN ('supported', 'supported_with_limitations') OR quoted_span IS NOT NULL),
  UNIQUE (provider_id, capability)
);

-- current_version_id -> integration_adapter_versions(id) is added via
-- ALTER below, once that table exists (circular reference).
CREATE TABLE integration_adapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES integration_providers(id) ON DELETE CASCADE,
  current_version_id UUID,
  kind TEXT NOT NULL DEFAULT 'api' CHECK (kind IN ('api', 'browser_automation')),
  file_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_id)
);

CREATE TABLE integration_adapter_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adapter_id UUID NOT NULL REFERENCES integration_adapters(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  generated_code TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by TEXT NOT NULL DEFAULT 'ai' CHECK (generated_by IN ('ai', 'human_patch')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'generated', 'sandbox_verified', 'human_reviewed', 'canary', 'certified', 'disabled'
  )),
  UNIQUE (adapter_id, version_number)
);

ALTER TABLE integration_adapters
  ADD CONSTRAINT integration_adapters_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES integration_adapter_versions(id) ON DELETE SET NULL;

CREATE INDEX idx_integration_documents_provider ON integration_documents (provider_id);
CREATE INDEX idx_integration_capabilities_provider ON integration_capabilities (provider_id);
CREATE INDEX idx_integration_adapter_versions_adapter ON integration_adapter_versions (adapter_id);

ALTER TABLE integration_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_adapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_adapter_versions ENABLE ROW LEVEL SECURITY;

-- No location_id/org_id on these tables (a provider adapter isn't scoped
-- to one restaurant — it's platform-level, like CONNECTOR_CATALOG itself).
-- Only platform admins (service role, today's admin tooling) touch this;
-- no per-location staff policy is needed the way pos_integrations has one.
CREATE POLICY "service_role_integration_providers" ON integration_providers
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "service_role_integration_documents" ON integration_documents
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "service_role_integration_capabilities" ON integration_capabilities
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "service_role_integration_adapters" ON integration_adapters
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "service_role_integration_adapter_versions" ON integration_adapter_versions
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE integration_providers IS
  'ADR-052 Phase 0 — Denis Integration Builder. Not yet written to by any live code path as of this migration.';

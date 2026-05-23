-- Per-organization Fiskaly TSS provisioning
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS fiskaly_tss_id TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS fiskaly_client_id TEXT;

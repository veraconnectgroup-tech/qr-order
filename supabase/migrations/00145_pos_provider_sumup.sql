-- Prompt 39 — SumUp skeleton adapter provider.

ALTER TABLE pos_integrations
  DROP CONSTRAINT IF EXISTS pos_integrations_provider_check;

ALTER TABLE pos_integrations
  ADD CONSTRAINT pos_integrations_provider_check CHECK (provider IN (
    'deliverect', 'orderbird', 'lightspeed', 'sumup', 'ready2order', 'custom'
  ));

ALTER TABLE pos_table_mappings
  DROP CONSTRAINT IF EXISTS pos_table_mappings_provider_check;

ALTER TABLE pos_table_mappings
  ADD CONSTRAINT pos_table_mappings_provider_check CHECK (provider IN (
    'deliverect', 'orderbird', 'lightspeed', 'sumup', 'ready2order', 'custom'
  ));

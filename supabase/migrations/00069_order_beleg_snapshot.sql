-- Immutable BelegData JSON frozen at fiscal.beleg issuance (B3).

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS beleg_snapshot jsonb DEFAULT NULL;

COMMENT ON COLUMN orders.beleg_snapshot IS
  'Immutable BelegData JSON frozen at beleg issuance.';

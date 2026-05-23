-- Fiskaly Cloud TSE (KassenSichV) signature storage
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tse_signature TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tse_data JSONB;

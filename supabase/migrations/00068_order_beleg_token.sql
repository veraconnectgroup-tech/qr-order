-- Public capability URL for web-viewable Kassenbeleg (B3).
-- beleg_token is issued only after TSE signature exists (see outbox fiscal.beleg handler).

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS beleg_token uuid DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_beleg_token
  ON orders (beleg_token)
  WHERE beleg_token IS NOT NULL;

COMMENT ON COLUMN orders.beleg_token IS
  'Capability token for public /api/beleg/[token] — set after TSE sign, unguessable UUID.';

-- Defense-in-depth for direct anon Supabase reads (primary path uses service role API).
CREATE POLICY "public_read_beleg_by_token" ON orders
  FOR SELECT USING (
    beleg_token IS NOT NULL
    AND beleg_token::text = coalesce(
      current_setting('request.headers', true)::json->>'x-beleg-token',
      ''
    )
  );

-- Defer payment method choice until guest pays on the order / bill screen.

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;

ALTER TABLE orders
  ALTER COLUMN payment_method SET DEFAULT 'unset';

UPDATE orders
SET payment_method = 'unset'
WHERE payment_method = 'online'
  AND payment_status = 'pending'
  AND stripe_payment_intent_id IS NULL;

ALTER TABLE orders
  ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('unset', 'online', 'at_bar', 'card_at_table'));

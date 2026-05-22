-- Where guests pay when using the in-person (at_bar) payment method
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS in_person_payment_location TEXT NOT NULL DEFAULT 'bar';

ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_in_person_payment_location_check;

ALTER TABLE locations
  ADD CONSTRAINT locations_in_person_payment_location_check
  CHECK (in_person_payment_location IN ('bar', 'counter', 'table'));

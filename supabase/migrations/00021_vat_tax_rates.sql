-- German VAT: product-level rate, takeaway flag, per-item tax snapshot
ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(4,2);
-- NULL = organization default (19%), 7.00 = ermäßigt (food), 19.00 = regulär (drinks)

ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_takeaway BOOLEAN DEFAULT false;

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(4,2) NOT NULL DEFAULT 19.00;

UPDATE order_items
SET tax_rate = 19.00
WHERE tax_rate IS NULL;

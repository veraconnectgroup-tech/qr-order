-- Test orders for dashboard kanban (Skyline Lounge)
-- Run in Supabase SQL Editor after cloud-setup.sql

DELETE FROM order_item_modifiers
WHERE order_item_id IN (
  SELECT oi.id FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE o.id IN (
    'e1000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000002',
    'e1000000-0000-4000-8000-000000000003'
  )
);

DELETE FROM order_items
WHERE order_id IN (
  'e1000000-0000-4000-8000-000000000001',
  'e1000000-0000-4000-8000-000000000002',
  'e1000000-0000-4000-8000-000000000003'
);

DELETE FROM orders
WHERE id IN (
  'e1000000-0000-4000-8000-000000000001',
  'e1000000-0000-4000-8000-000000000002',
  'e1000000-0000-4000-8000-000000000003'
);

-- Order #047 — New (pending)
INSERT INTO orders (
  id, location_id, table_id, order_number, status,
  subtotal, tax_percent, tax_amount, total, payment_status, created_at
) VALUES (
  'e1000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000012',
  47, 'pending',
  39.92, 19.00, 7.58, 47.50, 'paid',
  now() - interval '4 minutes'
);

INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total) VALUES
  ('e1000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'Aperol Spritz', 2, 9.50, 19.00),
  ('e1000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000004', 'Hugo Spritz', 1, 10.00, 10.00),
  ('e1000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000003', 'Espresso Martini', 1, 13.00, 13.00),
  ('e1000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000019', 'Truffle Fries', 2, 8.50, 17.00);

INSERT INTO order_item_modifiers (order_item_id, modifier_name, price)
SELECT id, 'Extra shot', 1.50
FROM order_items
WHERE order_id = 'e1000000-0000-4000-8000-000000000001'
  AND product_name = 'Espresso Martini';

-- Order #048 — Preparing
INSERT INTO orders (
  id, location_id, table_id, order_number, status,
  subtotal, tax_percent, tax_amount, total, payment_status, created_at, preparing_at
) VALUES (
  'e1000000-0000-4000-8000-000000000002',
  'b0000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000001',
  48, 'preparing',
  23.00, 19.00, 4.37, 27.37, 'paid',
  now() - interval '12 minutes',
  now() - interval '10 minutes'
);

INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total) VALUES
  ('e1000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000002', 'Negroni', 1, 12.00, 12.00),
  ('e1000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000012', 'Craft IPA', 2, 5.50, 11.00);

-- Order #049 — Ready
INSERT INTO orders (
  id, location_id, table_id, order_number, status,
  subtotal, tax_percent, tax_amount, total, payment_status, created_at, ready_at
) VALUES (
  'e1000000-0000-4000-8000-000000000003',
  'b0000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000008',
  49, 'ready',
  16.00, 19.00, 3.04, 19.04, 'paid',
  now() - interval '22 minutes',
  now() - interval '2 minutes'
);

INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total) VALUES
  ('e1000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000020', 'Nachos Supreme', 1, 9.00, 9.00),
  ('e1000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000015', 'Fresh Lemonade', 2, 4.50, 9.00);

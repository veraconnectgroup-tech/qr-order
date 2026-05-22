-- Optional serve size for drinks (e.g. 0.2L, 0.3L, 0.5L or custom).

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS requires_serve_size BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS serve_size_presets TEXT[],
  ADD COLUMN IF NOT EXISTS allow_custom_serve_size BOOLEAN NOT NULL DEFAULT true;

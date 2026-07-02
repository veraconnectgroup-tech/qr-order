-- Skyline Hamburg pilot — venue manifest (playbook + RAG tier), weather coords, product photos

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS venue_manifest JSONB;

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS venue_manifest JSONB;

COMMENT ON COLUMN organizations.venue_manifest IS
  'Denis MR-9 venue manifest — playbook pack, capability lattice, quality contract.';
COMMENT ON COLUMN locations.venue_manifest IS
  'Location Denis manifest — overrides org ceiling where allowed.';

UPDATE locations
SET venue_manifest = jsonb_build_object(
  'manifest_version', 1,
  'playbook_pack_id', 'skyline',
  'identity', jsonb_build_object(
    'default_language', 'de',
    'languages', jsonb_build_array('de', 'en', 'sr'),
    'persona', 'warm_short'
  ),
  'capabilities', jsonb_build_object(
    'relational', 3,
    'transactional', 3,
    'catalog_rag', 2,
    'guest_memory', 2,
    'anticipation', 2
  ),
  'policy', jsonb_build_object(
    'require_explicit_confirm', true,
    'rush_skip_upsell', true,
    'max_upsells_per_session', 2
  )
)
WHERE id = 'b0000000-0000-4000-8000-000000000001';

UPDATE locations
SET ai_concierge_config = COALESCE(ai_concierge_config, '{}'::jsonb) || jsonb_build_object(
  'intelligence', jsonb_build_object(
    'contextAwareness', true,
    'timezone', 'Europe/Berlin',
    'weather', jsonb_build_object(
      'enabled', true,
      'latitude', 53.5511,
      'longitude', 9.9937
    )
  ),
  'rollout', jsonb_build_object('mode', 'denis_only'),
  'llm', jsonb_build_object('narrateWithLlm', true),
  'memory', jsonb_build_object('returnGuestEnabled', true)
)
WHERE id = 'b0000000-0000-4000-8000-000000000001';

-- Top seller photos (canonical: src/lib/product-stock-images.ts)
UPDATE products SET image_url = 'https://images.unsplash.com/photo-1758218058958-78f40a716c20?w=600&q=80', updated_at = now()
WHERE id = 'f0000000-0000-4000-8000-000000000001' AND (image_url IS NULL OR image_url = '');

UPDATE products SET image_url = 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=600&q=80', updated_at = now()
WHERE id = 'f0000000-0000-4000-8000-000000000002' AND (image_url IS NULL OR image_url = '');

UPDATE products SET image_url = 'https://images.unsplash.com/photo-1676471793068-0db319151c3a?w=600&q=80', updated_at = now()
WHERE id = 'f0000000-0000-4000-8000-000000000003' AND (image_url IS NULL OR image_url = '');

UPDATE products SET image_url = 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&q=80', updated_at = now()
WHERE id = 'f0000000-0000-4000-8000-000000000004' AND (image_url IS NULL OR image_url = '');

UPDATE products SET image_url = 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=600&q=80', updated_at = now()
WHERE id = 'f0000000-0000-4000-8000-000000000013' AND (image_url IS NULL OR image_url = '');

UPDATE products SET image_url = 'https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=600&q=80', updated_at = now()
WHERE id = 'f0000000-0000-4000-8000-000000000019' AND (image_url IS NULL OR image_url = '');

UPDATE products SET image_url = 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=80', updated_at = now()
WHERE id = 'f0000000-0000-4000-8000-000000000020' AND (image_url IS NULL OR image_url = '');

UPDATE products SET image_url = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80', updated_at = now()
WHERE id = 'f0000000-0000-4000-8000-000000000021' AND (image_url IS NULL OR image_url = '');

UPDATE products SET image_url = 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600&q=80', updated_at = now()
WHERE id = 'f0000000-0000-4000-8000-000000000023' AND (image_url IS NULL OR image_url = '');

UPDATE products SET image_url = 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&q=80', updated_at = now()
WHERE id = 'f0000000-0000-4000-8000-000000000025' AND (image_url IS NULL OR image_url = '');

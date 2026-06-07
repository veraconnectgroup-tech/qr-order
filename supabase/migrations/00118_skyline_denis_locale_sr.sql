-- Skyline pilot — Serbian guest locale + Denis language defaults

UPDATE locations
SET
  default_locale = 'sr',
  menu_locale = 'sr',
  ai_concierge_config = COALESCE(ai_concierge_config, '{}'::jsonb) || jsonb_build_object(
    'language', jsonb_build_object(
      'venueDefault', 'sr',
      'followGuest', true,
      'fallbackWhenUnknown', 'venue'
    )
  )
WHERE id = 'b0000000-0000-4000-8000-000000000001';

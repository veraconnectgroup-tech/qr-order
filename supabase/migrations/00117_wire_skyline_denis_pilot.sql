-- Wire Skyline Lounge (iota pilot) — Denis Table OS full config

UPDATE locations
SET
  ai_concierge_enabled = true,
  accepting_orders = true,
  ai_concierge_config = jsonb_build_object(
    'version', 1,
    'rollout', jsonb_build_object('mode', 'denis_only'),
    'llm', jsonb_build_object('narrateWithLlm', true, 'slotExtractWithLlm', false),
    'ordering', jsonb_build_object(
      'slotExtractEnabled', true,
      'actLayerEnabled', true,
      'actDryRun', false,
      'actSubmitEnabled', true
    ),
    'memory', jsonb_build_object('returnGuestEnabled', true),
    'surfaces', jsonb_build_object('voiceEnabled', false),
    'ops', jsonb_build_object(
      'staffHintsEnabled', true,
      'rushSkipUpsell', true,
      'kdsStressSkipUpsell', true,
      'floorGraphEnabled', true,
      'autoRushEnabled', true,
      'autoRushBacklogMinutes', 20
    ),
    'learning', jsonb_build_object('learnedEdgesEnabled', true),
    'proactive', jsonb_build_object(
      'enabled', true,
      'guestWelcome', true,
      'guestWelcomeSeconds', 30,
      'billPrompt', true,
      'billPromptMinutes', 20,
      'orderDelay', true,
      'orderDelayMinutes', 15,
      'popularityPairing', true,
      'staffTableIdle', true,
      'staffTableIdleMinutes', 15,
      'staffWaiterRequest', true,
      'staffAllergy', true
    )
  )
WHERE id = 'b0000000-0000-4000-8000-000000000001';

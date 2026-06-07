import type { PartialConciergeConfig } from "@/lib/denis/config/concierge-config.schema";

/** Skyline / iota pilot — full Table OS wiring (M25 + floor + proactive). */
export const TABLE_OS_PILOT_CONFIG_PATCH: PartialConciergeConfig = {
  version: 1,
  rollout: { mode: "denis_only", tableSessionActorEnabled: true },
  llm: { narrateWithLlm: true, slotExtractWithLlm: false },
  ordering: {
    slotExtractEnabled: true,
    actLayerEnabled: true,
    actDryRun: false,
    actSubmitEnabled: true,
  },
  memory: { returnGuestEnabled: true },
  surfaces: { voiceEnabled: false },
  ops: {
    staffHintsEnabled: true,
    rushSkipUpsell: true,
    kdsStressSkipUpsell: true,
    floorGraphEnabled: true,
    autoRushEnabled: true,
    autoRushBacklogMinutes: 20,
  },
  learning: { learnedEdgesEnabled: true },
  language: {
    venueDefault: "sr",
    followGuest: true,
    fallbackWhenUnknown: "venue",
  },
  proactive: {
    enabled: true,
    guestWelcome: true,
    guestWelcomeSeconds: 30,
    browseFollowUp: true,
    browseFollowUpSeconds: 60,
    billPrompt: true,
    billPromptMinutes: 20,
    orderDelay: true,
    orderDelayMinutes: 15,
    popularityPairing: true,
    staffTableIdle: true,
    staffTableIdleMinutes: 15,
    staffWaiterRequest: true,
    staffAllergy: true,
  },
};

/** Demo Skyline location id (seed 00033). */
export const SKYLINE_PILOT_LOCATION_ID =
  "b0000000-0000-4000-8000-000000000001";

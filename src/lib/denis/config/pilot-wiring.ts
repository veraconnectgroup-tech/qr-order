import type { PartialConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";

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
  surfaces: { voiceEnabled: true, voiceTtsEnabled: true },
  ops: {
    staffHintsEnabled: true,
    rushSkipUpsell: true,
    kdsStressSkipUpsell: true,
    floorGraphEnabled: true,
    autoRushEnabled: true,
    autoRushBacklogMinutes: 20,
    stationQuestions: {
      ...CONCIERGE_PLATFORM_DEFAULTS.ops.stationQuestions,
      enabled: true,
    },
    stationAwareTell: true,
    tableTempo: {
      ...CONCIERGE_PLATFORM_DEFAULTS.ops.tableTempo,
      enabled: true,
    },
    dessertWindow: {
      ...CONCIERGE_PLATFORM_DEFAULTS.ops.dessertWindow,
      enabled: true,
    },
    serviceRecovery: {
      ...CONCIERGE_PLATFORM_DEFAULTS.ops.serviceRecovery,
      enabled: true,
    },
    tableTurnaround: {
      ...CONCIERGE_PLATFORM_DEFAULTS.ops.tableTurnaround,
      enabled: true,
    },
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
  intervention: {
    enabled: true,
    mode: "shadow",
    manifestVersion: "ijs-v1",
  },
  rhythm: {
    enabled: true,
    mode: "shadow",
    ops: {
      rushAlerts: true,
      staffingHints: true,
      rushThreshold: 1.8,
      targetSessionsPerWaiter: 4,
      staffingOccupancyThreshold: 0.55,
    },
  },
};

/** Demo Skyline location id (seed 00033). */
export const SKYLINE_PILOT_LOCATION_ID =
  "b0000000-0000-4000-8000-000000000001";

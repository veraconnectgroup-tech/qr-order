import type { PartialConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";

/** Skyline / iota pilot — full Table OS wiring (M25 + floor + proactive). */
export const TABLE_OS_PILOT_CONFIG_PATCH: PartialConciergeConfig = {
  version: 1,
  rollout: { mode: "denis_only", tableSessionActorEnabled: true },
  llm: {
    model: "gpt-4.1",
    fallbackModel: "gpt-4.1-nano",
    narrateWithLlm: true,
    slotExtractWithLlm: false,
    skipLlmWhenPossible: true,
  },
  ordering: {
    slotExtractEnabled: true,
    actLayerEnabled: true,
    actDryRun: false,
    actSubmitEnabled: true,
  },
  memory: { returnGuestEnabled: true },
  surfaces: {
    // See concierge-defaults.ts — guest voice input off until verified.
    voiceEnabled: false,
    voiceTtsEnabled: true,
    voiceStaffEnabled: true,
  },
  mentalModel: {
    ...CONCIERGE_PLATFORM_DEFAULTS.mentalModel,
    enabled: true,
    mode: "enforce",
  },
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
    agenticToolLoop: {
      enabled: true,
      shadowOnly: false,
      canaryPercent: 100,
      maxRounds: 3,
      legacySingleCallFallback: false,
      creditsPerExtraRound: 0,
    },
    lossPrevention: {
      enabled: true,
      voidLadderEnabled: true,
      transferInvariantsEnabled: true,
      paymentGuardrailsEnabled: true,
      cashRiskEnabled: true,
      discountPatternsEnabled: true,
      suspiciousReportEnabled: true,
      discountDeviationMultiplier: 2,
      digestMaxItems: 10,
      cashSessionOpenMinutes: 120,
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
    offerEnrich: true,
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
    manifestVersion: "ijs-v2",
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
  intelligence: {
    contextAwareness: true,
    timezone: "Europe/Berlin",
    dailyMenuLabel: null,
    localSportsTeam: null,
    weather: {
      enabled: true,
      openWeatherMapApiKey: null,
      latitude: 53.5511,
      longitude: 9.9937,
    },
  },
};

/** Demo Skyline location id (seed 00033). */
export const SKYLINE_PILOT_LOCATION_ID =
  "b0000000-0000-4000-8000-000000000001";

/** MR-9 — runtime fallback when DB `venue_manifest` is unset (Skyline pilot). */
export const SKYLINE_PILOT_VENUE_MANIFEST = {
  manifest_version: 1,
  playbook_pack_id: "skyline",
  identity: {
    default_language: "de",
    languages: ["de", "en", "sr"],
    persona: "warm_short",
  },
  capabilities: {
    relational: 3,
    transactional: 3,
    catalog_rag: 2,
    guest_memory: 2,
    anticipation: 2,
  },
  policy: {
    require_explicit_confirm: true,
    rush_skip_upsell: true,
    max_upsells_per_session: 2,
  },
} as const;

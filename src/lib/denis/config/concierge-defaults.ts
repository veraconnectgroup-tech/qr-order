import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";

/** Platform defaults — merged under org → location overrides. */
export const CONCIERGE_PLATFORM_DEFAULTS: ConciergeConfig = {
  version: 1,
  enabled: true,
  persona: {
    name: "Denis",
    role: "Head waiter",
    tone: "warm_short",
    greetingStyle: "offer_drink_or_food",
    forbiddenPhrases: [],
    emoji: false,
    maxWordsPerReply: 45,
  },
  language: {
    venueDefault: "de",
    followGuest: true,
    fallbackWhenUnknown: "venue",
  },
  context: {
    scroll: true,
    tableOrders: true,
    orderStatus: true,
    manualCart: true,
    orderHistory: true,
    includePairingHistory: true,
    maxContextTokens: 2000,
  },
  ordering: {
    flow: "denis_short",
    requireExplicitConfirm: true,
    allowMultiItemParse: true,
    defaultServeSize: null,
    maxItemsPerOrder: 50,
    maxQuantityPerLine: 20,
  },
  upsell: {
    foodAfterDrinks: true,
    foodAfterDrinksProductIds: null,
    dessertAfterDelivered: true,
    dessertDelayMinutes: 20,
    maxUpsellsPerSession: 2,
    respectDecline: true,
  },
  proactive: {
    enabled: true,
    browseNudgeMinutes: 3,
    pairing: true,
    dessert: true,
    slowKitchen: true,
    slowKitchenThresholdMinutes: 25,
    reviewPrompt: true,
    reviewPromptAfterDelivered: true,
    minMinutesBetweenProactive: 4,
    shareSessionWithChat: true,
  },
  policy: {
    allergiesStrict: true,
    blockAlcoholWithoutFood: false,
    blockOrderingWhenClosed: true,
    maxOrderTotal: null,
    requireServeSizeForDrinks: true,
  },
  llm: {
    model: null,
    fallbackModel: null,
    temperatureOrdering: 0.2,
    temperatureRecommend: 0.5,
    parseRetryAttempts: 1,
    skipLlmWhenPossible: true,
  },
  handoff: {
    waiterCall: true,
    paymentHint: true,
    phrases: [],
  },
  experiments: {
    playbookVariant: null,
    exampleSetId: null,
  },
  credits: {
    chargeProactive: false,
    chargeDeterministic: false,
  },
  rollout: {
    mode: "shadow",
  },
  party: {
    mode: "shared_cart",
  },
  ops: {
    staffHintsEnabled: true,
    rushSkipUpsell: true,
    kdsStressSkipUpsell: true,
    floorGraphEnabled: false,
    autoRushEnabled: false,
    autoRushBacklogMinutes: 20,
  },
};

export const CONCIERGE_CONFIG_CACHE_TTL_SECONDS = 300;
export const CONCIERGE_CONFIG_CACHE_KEY_PREFIX = "ai:config:";

export function conciergeConfigCacheKey(locationId: string): string {
  return `${CONCIERGE_CONFIG_CACHE_KEY_PREFIX}${locationId}`;
}

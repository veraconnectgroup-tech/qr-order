export {
  deriveTrajectoryFromFloor,
  detectRushMode,
  ewmaRemainingMinutes,
  ewmaTurnoverMinutes,
  formatTurnoverCopilotLine,
  formatTurnoverRemainingHint,
  predictTableTurnover,
  shouldSuggestBillForTurnover,
  turnoverDisplayStatus,
  turnoverStatusEmoji,
  turnoverStatusLabel,
  type RushModeDetection,
  type TableTurnoverPrediction,
  type TurnoverDisplayStatus,
} from "@/lib/denis/intelligence/table-turnover";
export {
  loadTableTurnoverPriors,
  loadVenueTurnoverFallbackMinutes,
  predictGuestSessionDuration,
  type GuestDurationPriorInput,
} from "@/lib/denis/intelligence/load-table-turnover-priors";
export {
  loadTrendingMenuProducts,
  type TrendingMenuProducts,
} from "@/lib/denis/intelligence/load-trending-menu-products";
export {
  personalizeMenu,
  personalizationBadgeByProductId,
  personalizationBoostLabel,
  buildPersonalizationStrip,
  reorderCategoriesByPersonalization,
  MIN_TRENDING_ORDERS_TODAY,
  NEW_ITEM_MAX_AGE_DAYS,
  type MenuGuestMemoryProjection,
  type MenuPersonalizationCategory,
  type PersonalizedMenuBoost,
  type PersonalizedMenuItem,
  type PersonalizedMenuSection,
  type PersonalizationMeta,
  type PersonalizationStripChip,
  type PersonalizationStripItem,
  type VkgPairingHint,
} from "@/lib/denis/intelligence/menu-personalization";
export {
  detectTransferOpportunities,
  formatTransferCopilotLine,
  formatTransferSuggestionHeadline,
  formatTransferSuggestionReason,
  limitTransferSuggestions,
  MAX_TRANSFER_SUGGESTIONS,
  transferSuggestionActionUrl,
  transferSuggestionStaffMessage,
  type TransferReason,
  type TransferReservation,
  type TransferSuggestion,
  type TransferTableState,
  type TransferWaitingParty,
} from "@/lib/denis/intelligence/table-transfer-advisor";
export {
  evaluateInventory,
  autoUnavailableProductIds,
  classifyStockStatus,
  formatInventoryCopilotBrief,
  formatMorningPrepReplenishment,
  formatPredictiveRunoutAlert,
  guestSubstitutionHint,
  inventoryAlertToStaffNotification,
  shouldSkipProactiveForUnavailableProduct,
  type StockLevel,
  type InventoryAlert,
  type ProductWithStock,
} from "@/lib/denis/intelligence/inventory-awareness";
export {
  loadVenueInventorySnapshot,
  mergeUnavailableProductIds,
  type VenueInventorySnapshot,
} from "@/lib/denis/intelligence/load-venue-inventory";
export {
  applyOrderInventoryDecrement,
  resolveInventorySubstitutionMessage,
} from "@/lib/denis/intelligence/apply-order-inventory";
export {
  discoverPairings,
  formatDiscoveredPairingLine,
  formatLearnedPairingGuestPrompt,
  learnedEdgeRowToPairing,
  meetsLearnedPairingSuggestionThreshold,
  runMarketBasketAnalysis,
  MARKET_BASKET_THRESHOLDS,
  type LearnedPairing,
} from "@/lib/denis/intelligence/dynamic-vkg";
export {
  adaptSceneForAccessibility,
  filterSceneLayersForAccessibility,
} from "@/lib/denis/intelligence/accessibility-adapter";
export {
  avgDrinkDurationMinutes,
  formatPartyDrinkGapMessage,
  formatSommelierPairingMessage,
  formatSommelierRefillMessage,
  isOccasionAllowed,
  resolveDrinkOccasion,
  suggestDrinksForFood,
  type SommelierPairingSuggestion,
} from "@/lib/denis/intelligence/drink-sommelier";
export {
  buildContextAwarenessSnapshot,
  buildContextAwarenessSituationBlock,
  buildEventSituationBlock,
  buildSeasonalContext,
  buildSeasonalSituationBlock,
  buildTimeOfDayContext,
  buildTimeSituationBlock,
  resolveEventAwarenessContext,
  resolveSeasonFromMonth,
  resolveTimeOfDayBand,
  type ContextAwarenessSnapshot,
  type EventAwarenessContext,
  type SeasonKind,
  type SeasonalContext,
  type TimeOfDayBand,
  type TimeOfDayContext,
} from "@/lib/denis/intelligence/event-context";
export {
  buildExternalContextSituationBlock,
  resolveContextAwareness,
} from "@/lib/denis/intelligence/resolve-context-awareness";
export {
  buildWeatherContextFromReading,
  buildWeatherSituationBlock,
  buildWeatherSuggestion,
  classifyWeatherCondition,
  loadCachedWeatherContext,
  parseOpenWeatherResponse,
  resolveOpenWeatherApiKey,
  WEATHER_CACHE_TTL_SECONDS,
  weatherCacheKey,
  type WeatherConditionKind,
  type WeatherContext,
} from "@/lib/denis/intelligence/weather-context";
export {
  deriveGuestAccessibility,
  buildAccessibilityEvidenceBlock,
  filterEssentialSceneLayers,
} from "@/lib/denis/cognition/mental-model/derive-accessibility";
export {
  DEFAULT_GUEST_ACCESSIBILITY,
  toSceneAccessibility,
  type GuestAccessibilityPrefs,
  type SceneAccessibility,
  type ClientAccessibilitySignals,
} from "@/lib/denis/cognition/mental-model/accessibility-types";

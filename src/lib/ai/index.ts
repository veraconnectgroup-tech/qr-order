export {
  AI_CONFIG,
  AI_BLOCKED_PATTERNS,
  AI_SUPPORTED_LANGUAGES,
  detectGuestMessageLanguage,
  isOpenAiConfigured,
  menuLanguageLabel,
  resolveAiPromptLanguage,
  resolveGuestMessageLanguage,
} from "@/lib/ai/config";
export type { GuestLanguageDetection } from "@/lib/ai/config";
export { buildSystemPrompt } from "@/lib/ai/build-system-prompt";
export { getCachedMenuForLocation, invalidateMenuCache } from "@/lib/ai/menu-cache";
export { moderateGuestInput } from "@/lib/ai/moderation";
export {
  AiCircuitOpenError,
  AiOpenAiError,
  callOpenAiChat,
  resetAiCircuitBreakerForTests,
} from "@/lib/ai/openai-client";
export { formatOrderContextBlock, loadGuestOrdersForAi } from "@/lib/ai/order-context";
export type { AiGuestOrder, AiGuestOrderItem } from "@/lib/ai/order-context";
export {
  detectDessertTrigger,
  detectPairingTrigger,
  detectProactiveTrigger,
  detectSlowKitchenTrigger,
  detectWelcomeBackTrigger,
} from "@/lib/ai/proactive-triggers";
export {
  generateAiIntelligence,
  persistAiInsights,
  runDailyAiIntelligence,
} from "@/lib/ai/intelligence-service";
export type {
  AiInsightInsert,
  AiInsightSeverity,
  AiInsightType,
} from "@/lib/ai/intelligence-service";
export {
  parseBrowsingContextToScrollContext,
} from "@/lib/ai/scroll-context";
export type { ScrollContext, ScrollContextView } from "@/lib/ai/scroll-context";
export type {
  ProactiveTriggerKind,
  ProactiveTriggerMatch,
} from "@/lib/ai/proactive-triggers";
export type { AiChatRequest } from "@/lib/ai/chat-service";
export { handleAiChat, aiChatRequestSchema } from "@/lib/ai/chat-service";
export { parseAiStructuredResponse } from "@/lib/ai/parse-response";
export type { AiChatRecommendation } from "@/lib/ai/parse-response";
export { verifyAiGuestContext } from "@/lib/ai/verify-guest-context";
export type { AiGuestContext } from "@/lib/ai/verify-guest-context";
export type {
  AiGuestPreferences,
  AiMenuCachePayload,
  AiProductSummary,
  AiPromptLanguage,
  AiRecommendation,
  AiStructuredResponse,
  BuildSystemPromptInput,
  ModerationResult,
  OpenAiCallResult,
  OpenAiChatMessage,
} from "@/lib/ai/types";

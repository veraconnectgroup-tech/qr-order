export { AI_CONFIG, AI_BLOCKED_PATTERNS, AI_SUPPORTED_LANGUAGES, isOpenAiConfigured, resolveAiPromptLanguage } from "@/lib/ai/config";
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
  detectWelcomeBackTrigger,
} from "@/lib/ai/proactive-triggers";
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

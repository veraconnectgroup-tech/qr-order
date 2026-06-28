/** Denis cognition safety — re-export canonical prompt shield (ADR-019). */
export {
  buildSecurityBlockedPayload,
  heuristicScreen,
  isBenignFoodExclusion,
  logShieldBlock,
  normalizeForScreening,
  recordShieldBlock,
  regexScreen,
  screenOutput,
  shieldGracefulGuestMessage,
  shieldGuestInput,
  SHIELD_BLOCK_ALERT_THRESHOLD,
  SHIELD_GRACEFUL_GUEST_MESSAGE,
  stripInvisibleAndBidiChars,
  type ShieldResult,
  type ShieldSessionState,
} from "@/lib/ai/prompt-shield";

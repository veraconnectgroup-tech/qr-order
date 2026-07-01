import { AI_CONFIG } from "@/lib/ai/config";
import {
  isBenignFoodExclusion,
  shieldGuestInput,
} from "@/lib/ai/prompt-shield";
import type { ModerationResult } from "@/lib/ai/types";
import { sanitizeHtml } from "@/lib/security/sanitize";

export { shieldGracefulGuestMessage } from "@/lib/ai/prompt-shield";

export function moderateGuestInput(raw: string): ModerationResult {
  const input = sanitizeHtml(raw).trim();

  if (!input) {
    return { safe: false, reason: "empty_message" };
  }

  if (input.length > AI_CONFIG.input.maxLength) {
    return { safe: false, reason: "message_too_long" };
  }

  if (!isBenignFoodExclusion(input)) {
    const shield = shieldGuestInput(input);
    if (shield && !shield.safe) {
      return {
        safe: false,
        reason: shield.reason ?? "blocked_pattern",
      };
    }
  }

  return { safe: true };
}

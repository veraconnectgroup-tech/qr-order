import { AI_BLOCKED_PATTERNS, AI_CONFIG } from "@/lib/ai/config";
import type { ModerationResult } from "@/lib/ai/types";
import { sanitizeHtml } from "@/lib/security/sanitize";

export function moderateGuestInput(raw: string): ModerationResult {
  const input = sanitizeHtml(raw).trim();

  if (!input) {
    return { safe: false, reason: "empty_message" };
  }

  if (input.length > AI_CONFIG.input.maxLength) {
    return { safe: false, reason: "message_too_long" };
  }

  for (const pattern of AI_BLOCKED_PATTERNS) {
    if (pattern.test(input)) {
      return { safe: false, reason: "blocked_pattern" };
    }
  }

  return { safe: true };
}

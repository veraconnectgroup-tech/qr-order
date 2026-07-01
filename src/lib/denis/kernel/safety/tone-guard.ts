import {
  isDenisRefusalReply,
  orderingContinueReply,
  orderingFlowRecoveryReply,
  politeReengageReply,
  type ConversationLeadershipContext,
} from "@/lib/ai/conversation-leadership";
import type { AiStructuredResponse } from "@/lib/ai/types";

export type ToneGuardInput = {
  structured: AiStructuredResponse;
  language: string;
  guestMessage: string;
  forbiddenPhrases: string[];
  context?: ConversationLeadershipContext;
};

export type ToneGuardResult = {
  structured: AiStructuredResponse;
  corrected: boolean;
  reason?: string;
};

function hasCommercePressure(ctx: ConversationLeadershipContext | undefined): boolean {
  if (!ctx) return false;
  return (
    ctx.inOrderingFlow === true ||
    ctx.awaitingAnswer === true ||
    ctx.commercePressure === "open" ||
    ctx.commercePressure === "confirm" ||
    ctx.transactionalTurn === true ||
    ctx.conversationMode === "ordering" ||
    ctx.conversationMode === "settling"
  );
}

/** Post-skill: strip forbidden phrases + soft refusal recovery (no wholesale LLM discard). */
export function applyToneGuard(input: ToneGuardInput): ToneGuardResult {
  let message = input.structured.message;
  let corrected = false;
  let reason: string | undefined;

  for (const phrase of input.forbiddenPhrases) {
    const trimmed = phrase.trim();
    if (!trimmed) continue;
    const pattern = new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    if (pattern.test(message)) {
      message = message.replace(pattern, "").replace(/\s{2,}/g, " ").trim();
      corrected = true;
      reason = "forbidden_phrase_removed";
    }
  }

  if (isDenisRefusalReply(message)) {
    const inCommerce = hasCommercePressure(input.context);
    message = inCommerce
      ? orderingContinueReply(input.language)
      : input.context?.hasPriorMessages || inCommerce
        ? orderingFlowRecoveryReply(input.language, input.guestMessage)
        : politeReengageReply(input.language);
    corrected = true;
    reason = reason ?? "refusal_recovery";
  }

  if (!corrected) {
    return { structured: input.structured, corrected: false };
  }

  return {
    structured: {
      ...input.structured,
      message,
    },
    corrected: true,
    reason,
  };
}

const HARMFUL_OUTPUT_PATTERN =
  /\b(kill yourself|self[\s-]?harm|how to make (a )?bomb|credit card number|ssn\b|social security)\b/i;

export type SafetyGuardInput = {
  structured: AiStructuredResponse;
  language: string;
};

export type SafetyGuardResult = {
  structured: AiStructuredResponse;
  blocked: boolean;
  reason?: string;
};

/** Post-skill: block harmful guest-facing content. */
export function applySafetyGuard(input: SafetyGuardInput): SafetyGuardResult {
  if (!HARMFUL_OUTPUT_PATTERN.test(input.structured.message)) {
    return { structured: input.structured, blocked: false };
  }

  const fallback =
    input.language === "de"
      ? "Ich helfe Ihnen gerne bei Speisen und Getränken — was darf ich bringen?"
      : input.language === "sr" || input.language === "hr"
        ? "Tu sam za meni i porudžbinu — šta biste želeli?"
        : "I'm here to help with the menu and your order — what would you like?";

  return {
    structured: {
      ...input.structured,
      message: fallback,
      recommendations: [],
      proposedItems: [],
      quickReplies: [],
      submitOrder: false,
      intent: "chat",
    },
    blocked: true,
    reason: "harmful_content_blocked",
  };
}

export function buildAllergyPreSkillBlock(input: {
  allergyLabels: string[];
  guardMessage?: string | null;
}): string | null {
  if (!input.allergyLabels.length && !input.guardMessage) return null;
  const lines = ["ALLERGY CONTEXT (pre-skill):"];
  if (input.allergyLabels.length) {
    lines.push(`Guest allergens: ${input.allergyLabels.join(", ")}`);
    lines.push("Never recommend items containing these allergens.");
  }
  if (input.guardMessage) {
    lines.push(`Active conflict: ${input.guardMessage}`);
  }
  return lines.join("\n");
}

export function buildCartStatePreSkillBlock(cartDraftText: string): string | null {
  const trimmed = cartDraftText.trim();
  if (!trimmed || trimmed === "(empty)") return null;
  return `CART STATE (pre-skill):\n${trimmed}`;
}

export function buildMenuFilterPreSkillBlock(unavailableNames: string[]): string | null {
  if (!unavailableNames.length) return null;
  return `UNAVAILABLE ITEMS (pre-skill — do not offer):\n${unavailableNames.join(", ")}`;
}

export function formatPrice(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`;
}

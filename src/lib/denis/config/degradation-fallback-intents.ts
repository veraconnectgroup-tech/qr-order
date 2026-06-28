import { classifyGuestRecoveryIntent } from "@/lib/guest/denis-guest-recovery";
import type { GuestRecoveryIntent } from "@/lib/guest/denis-guest-recovery";
import { tForAiGuestLanguage } from "@/lib/ai/guest-language";
import type { TranslationKey } from "@/lib/i18n/translations";
import {
  degradationForcesT0Only,
  type DegradationLevel,
} from "@/lib/denis/config/degradation-ladder";

const FALLBACK_KEYS: Record<GuestRecoveryIntent, TranslationKey> = {
  order: "denis.degradation.fallback.order",
  status: "denis.degradation.fallback.status",
  payment: "denis.degradation.fallback.payment",
  bill_amount: "denis.degradation.fallback.bill",
  waiter: "denis.degradation.fallback.waiter",
  general: "denis.degradation.fallback.general",
};

const FALLBACK_QUICK_REPLIES: Partial<
  Record<GuestRecoveryIntent, TranslationKey[]>
> = {
  order: ["denis.degradation.fallback.chip.menu", "denis.degradation.fallback.chip.cart"],
  payment: ["denis.degradation.fallback.chip.pay"],
  general: [
    "denis.degradation.fallback.chip.menu",
    "denis.degradation.fallback.chip.waiter",
  ],
};

export type DegradationFallbackTurn = {
  message: string;
  quickReplies: string[];
  intent: GuestRecoveryIntent;
  allowTurnPipeline: boolean;
};

/** Template-only guest turn when ladder is at fallback — no LLM. */
export function resolveDegradationFallbackTurn(input: {
  guestMessage: string;
  language: string;
  level: DegradationLevel;
}): DegradationFallbackTurn | null {
  if (!degradationForcesT0Only(input.level) || input.level === "offline") {
    return null;
  }

  const intent = classifyGuestRecoveryIntent(input.guestMessage);
  const message = tForAiGuestLanguage(FALLBACK_KEYS[intent], input.language);
  const quickReplies =
    FALLBACK_QUICK_REPLIES[intent]?.map((key) =>
      tForAiGuestLanguage(key, input.language)
    ) ?? [];

  return {
    message,
    quickReplies,
    intent,
    allowTurnPipeline: intent === "order",
  };
}

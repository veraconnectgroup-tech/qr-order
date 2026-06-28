"use client";

import { useEffect, useState } from "react";
import {
  classifyGuestRecoveryIntent,
  isGuestPauseMessage,
  isMenuBrowseMessage,
} from "@/lib/guest/denis-guest-recovery";
import type { TranslationKey } from "@/lib/i18n/translations";

export const DENIS_THINKING_STEP_MS = 2400;
export const MAX_DENIS_THINKING_STEPS = 2;

export type DenisThinkingContext =
  | "menu"
  | "order"
  | "status"
  | "payment"
  | "waiter"
  | "pause"
  | "general";

export type DenisThinkingPersonalization = {
  isReturningGuest?: boolean;
  hasAllergy?: boolean;
  isLargeOrder?: boolean;
};

const THINKING_STEPS: Record<DenisThinkingContext, TranslationKey[]> = {
  menu: ["ai.chat.thinking.menu", "ai.chat.thinking.recommend"],
  order: ["ai.chat.thinking.menu", "ai.chat.thinking.order"],
  status: ["ai.chat.thinking.status"],
  payment: ["ai.chat.thinking.payment"],
  waiter: ["ai.chat.thinking.waiter"],
  pause: ["ai.chat.thinking.pause"],
  general: ["ai.chat.thinking.social", "ai.chat.thinking.llm"],
};

export function capDenisThinkingStepKeys(
  keys: TranslationKey[]
): TranslationKey[] {
  return keys.slice(0, MAX_DENIS_THINKING_STEPS);
}

export function resolveDenisThinkingContext(message: string): DenisThinkingContext {
  const text = message.trim();
  if (isGuestPauseMessage(text)) return "pause";
  if (isMenuBrowseMessage(text)) return "menu";

  const intent = classifyGuestRecoveryIntent(message);
  if (intent === "payment" || intent === "bill_amount") return "payment";
  if (intent === "status") return "status";
  if (intent === "waiter") return "waiter";
  if (intent === "order") return "order";
  return "general";
}

function resolvePersonalizedStepKey(
  context: DenisThinkingContext,
  personalization?: DenisThinkingPersonalization
): TranslationKey | null {
  if (!personalization) return null;

  if (
    personalization.hasAllergy &&
    (context === "menu" || context === "order")
  ) {
    return "ai.chat.thinking.allergy";
  }

  if (personalization.isLargeOrder && context === "order") {
    return "ai.chat.thinking.largeOrder";
  }

  if (personalization.isReturningGuest && context === "menu") {
    return "ai.chat.thinking.favorites";
  }

  return null;
}

export function resolveDenisThinkingStepKeys(
  message: string,
  personalization?: DenisThinkingPersonalization
): TranslationKey[] {
  const context = resolveDenisThinkingContext(message);
  const base = [...THINKING_STEPS[context]];
  const personalized = resolvePersonalizedStepKey(context, personalization);

  if (personalized) {
    const tail = base.filter((key) => key !== personalized);
    return capDenisThinkingStepKeys([personalized, ...tail]);
  }

  return capDenisThinkingStepKeys(base);
}

export function useRotatingThinkingLabel(
  steps: string[],
  active: boolean
): string | null {
  const [stepIndex, setStepIndex] = useState(0);
  const labels = steps.filter(Boolean).slice(0, MAX_DENIS_THINKING_STEPS);

  useEffect(() => {
    if (active) setStepIndex(0);
  }, [active, labels.join("|")]);

  useEffect(() => {
    if (!active || labels.length <= 1) return;
    const id = window.setInterval(
      () => setStepIndex((index) => (index + 1) % labels.length),
      DENIS_THINKING_STEP_MS
    );
    return () => window.clearInterval(id);
  }, [active, labels]);

  if (!active || labels.length === 0) return null;
  return labels[stepIndex] ?? labels[0];
}

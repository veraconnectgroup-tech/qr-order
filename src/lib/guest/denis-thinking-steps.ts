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

/** Honest fallback while server preview is in flight — never guess work we are not doing. */
export const DENIS_THINKING_WAIT_KEY: TranslationKey = "ai.chat.thinking.quick";

export type DenisThinkingContext =
  | "menu"
  | "order"
  | "status"
  | "payment"
  | "waiter"
  | "pause"
  | "general";

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

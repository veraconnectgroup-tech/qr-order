"use client";

import { useEffect, useState } from "react";
import { classifyGuestRecoveryIntent } from "@/lib/guest/denis-guest-recovery";
import type { TranslationKey } from "@/lib/i18n/translations";

export const DENIS_THINKING_STEP_MS = 2400;

const MENU_BROWSE_PATTERN =
  /(šta\s+imate|sta\s+imate|šta\s+imam|sta\s+imam|was\s+habt|what\s+do\s+you\s+have|preporuk|empfehl|recommend|suggest|pivo|pizza|jelo|piće|pice|drink|dessert|desert|vegan|vegetar|gluten|allerg)/i;

const GUEST_PAUSE_PATTERN =
  /\b(nisam\s+j[oš]s?|ne\s+j[oš]s?|jo[sš]\s+gledamo|not\s+yet|noch\s+nicht|dođi|dodji|vrati\s+se|come\s+back|za\s+\d+\s*minut|\d+\s*minut\s+ponovo|za\s+koj[ií]\s+minut)\b/i;

export type DenisThinkingContext =
  | "menu"
  | "order"
  | "status"
  | "payment"
  | "waiter"
  | "pause"
  | "general";

const THINKING_STEPS: Record<DenisThinkingContext, TranslationKey[]> = {
  menu: ["ai.chat.thinking.menu", "ai.chat.thinking.recommend"],
  order: ["ai.chat.thinking.menu", "ai.chat.thinking.order"],
  status: ["ai.chat.thinking.status"],
  payment: ["ai.chat.thinking.payment"],
  waiter: ["ai.chat.thinking.waiter"],
  pause: ["ai.chat.thinking.pause", "ai.chat.thinking.social"],
  general: ["ai.chat.thinking.social", "ai.chat.thinking.llm"],
};

export function resolveDenisThinkingContext(message: string): DenisThinkingContext {
  const text = message.trim();
  if (GUEST_PAUSE_PATTERN.test(text)) return "pause";
  if (MENU_BROWSE_PATTERN.test(text)) return "menu";

  const intent = classifyGuestRecoveryIntent(message);
  if (intent === "payment") return "payment";
  if (intent === "status") return "status";
  if (intent === "waiter") return "waiter";
  if (intent === "order") return "order";
  return "general";
}

export function resolveDenisThinkingStepKeys(message: string): TranslationKey[] {
  return THINKING_STEPS[resolveDenisThinkingContext(message)];
}

export function useRotatingThinkingLabel(
  steps: string[],
  active: boolean
): string | null {
  const [stepIndex, setStepIndex] = useState(0);
  const labels = steps.filter(Boolean);

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

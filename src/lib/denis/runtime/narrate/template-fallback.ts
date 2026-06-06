import type {
  NarrationFacts,
  SanitizedNarration,
} from "@/lib/denis/runtime/narrate/narration-facts.schema";
import {
  cartAddedMessage,
  cartSummaryMessage,
  clarifyPaymentMessage,
  denisIntroMessage,
  handoffWaitMessage,
  orderSentTemplateMessage,
  pairingSuggestionMessage,
  reconcileCartMessage,
} from "@/lib/denis/runtime/act/guest-copy";
import { lintNarrationMessage } from "@/lib/denis/runtime/narrate/lint-narration";

function truncateWords(message: string, maxWords: number): string {
  const words = message.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return message.trim();
  return `${words.slice(0, maxWords).join(" ")}…`;
}

/** Deterministic template when T3 fails lint or conflict goal is active. */
export function templateNarrationFallback(facts: NarrationFacts): string {
  const { committed, persona, goal, language } = facts;

  if (committed.conflictQuestion) {
    return committed.conflictQuestion;
  }

  if (committed.returnGuestWelcome) {
    return committed.returnGuestWelcome;
  }

  if (committed.blockedReason) {
    return committed.blockedReason;
  }

  if (committed.handoffMessage) {
    return committed.handoffMessage;
  }

  if (committed.orderNumber != null) {
    return orderSentTemplateMessage(language, committed.orderNumber);
  }

  if (committed.addedItems?.length) {
    return cartAddedMessage(language, committed.addedItems.join(", "));
  }

  if (committed.pairingSuggestion) {
    const { name, price } = committed.pairingSuggestion;
    return pairingSuggestionMessage(language, name, price);
  }

  if (committed.statusSummary) {
    return committed.statusSummary;
  }

  if (committed.cartSummary) {
    return cartSummaryMessage(language, committed.cartSummary);
  }

  if (goal === "RECONCILE_CART") {
    return reconcileCartMessage(language);
  }

  if (goal === "HANDOFF") {
    return handoffWaitMessage(language);
  }

  if (goal === "CLARIFY_SLOT") {
    return clarifyPaymentMessage(language);
  }

  return denisIntroMessage(language, persona.name);
}

export function sanitizeNarrationOutput(
  message: string,
  facts: NarrationFacts
): SanitizedNarration {
  const lint = lintNarrationMessage(message, facts);

  if (lint.ok) {
    return {
      message: truncateWords(message, facts.persona.maxWords),
      tier: "T3",
      lintPassed: true,
      issues: [],
      usedFallback: false,
    };
  }

  const onlyWordLimit =
    lint.issues.length === 1 && lint.issues[0]?.code === "WORD_LIMIT";

  if (onlyWordLimit) {
    return {
      message: truncateWords(message, facts.persona.maxWords),
      tier: "T3",
      lintPassed: true,
      issues: lint.issues,
      usedFallback: false,
    };
  }

  return {
    message: templateNarrationFallback(facts),
    tier: "template",
    lintPassed: false,
    issues: lint.issues,
    usedFallback: true,
  };
}

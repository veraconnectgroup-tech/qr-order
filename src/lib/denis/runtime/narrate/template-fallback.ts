import type {
  NarrationFacts,
  SanitizedNarration,
} from "@/lib/denis/runtime/narrate/narration-facts.schema";
import { lintNarrationMessage } from "@/lib/denis/runtime/narrate/lint-narration";

function truncateWords(message: string, maxWords: number): string {
  const words = message.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return message.trim();
  return `${words.slice(0, maxWords).join(" ")}…`;
}

/** Deterministic template when T3 fails lint or conflict goal is active. */
export function templateNarrationFallback(facts: NarrationFacts): string {
  const { committed, persona, goal } = facts;

  if (committed.conflictQuestion) {
    return committed.conflictQuestion;
  }

  if (committed.blockedReason) {
    return committed.blockedReason;
  }

  if (committed.orderNumber != null) {
    return `Narudžbina #${committed.orderNumber} je poslata.`;
  }

  if (committed.addedItems?.length) {
    const items = committed.addedItems.join(", ");
    return `Dodato u korpu: ${items}.`;
  }

  if (committed.pairingSuggestion) {
    const { name, price } = committed.pairingSuggestion;
    return `Predlog: ${name} (${price}).`;
  }

  if (committed.statusSummary) {
    return committed.statusSummary;
  }

  if (committed.cartSummary) {
    return `U korpi: ${committed.cartSummary}.`;
  }

  if (goal === "RECONCILE_CART") {
    return "Korpa i chat se ne slažu — da spojim u jednu narudžbinu?";
  }

  if (goal === "HANDOFF") {
    return "Pozivam konobara — samo trenutak.";
  }

  return `Ja sam ${persona.name}. Recite šta želite, pa ću dodati u narudžbinu.`;
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

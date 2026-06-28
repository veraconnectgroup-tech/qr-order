/** Deterministic return-guest welcome — T0, no LLM (ADR-005 §7.2). */
import { buildRelationshipWelcomeMessage } from "@/lib/denis/learning/guest-memory/build-relationship-welcome";
import type { GuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";

function joinVisitItems(items: string[], language: string): string {
  const lang = language.toLowerCase().slice(0, 2);
  if (lang === "en" || lang === "de") {
    return items.join(", ");
  }
  return items.join(" i ");
}

export function buildReturnGuestWelcomeMessage(input: {
  language: string;
  lastVisitItems: string[];
  visitCount: number;
  lastFeedbackSentiment?: "positive" | "neutral" | "negative" | null;
  template?: string | null;
  memory?: GuestMemoryProjection | null;
}): string | null {
  const relationshipWelcome = buildRelationshipWelcomeMessage({
    language: input.language,
    visitCount: input.visitCount,
    memory: input.memory ?? null,
  });
  if (relationshipWelcome) return relationshipWelcome;

  const items = input.lastVisitItems.filter(Boolean).slice(0, 4);
  if (input.visitCount < 2) return null;

  if (input.lastFeedbackSentiment === "positive") {
    const lang = input.language.toLowerCase().slice(0, 2);
    if (lang === "de") return "Schön, dass Sie wieder da sind!";
    if (lang === "en") return "Great to see you again!";
    return "Drago nam je što ste opet tu!";
  }

  if (items.length === 0) return null;

  const itemsText = joinVisitItems(items, input.language);

  if (input.template?.includes("{items}")) {
    return input.template.replace("{items}", itemsText);
  }

  const lang = input.language.toLowerCase().slice(0, 2);
  if (lang === "de") {
    return `Beim letzten Mal: ${itemsText} — noch einmal?`;
  }
  if (lang === "en") {
    return `Last time you had ${itemsText} — again?`;
  }
  return `Prošli put ste imali ${itemsText} — ponovo?`;
}

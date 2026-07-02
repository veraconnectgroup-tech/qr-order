import { buildOccasionAwareWelcomeMessage } from "@/lib/denis/learning/guest-memory/build-occasion-aware-welcome";
import type { GuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";

/** Deterministic return-guest welcome — T0, no LLM (ADR-005 §7.2). */
export function buildReturnGuestWelcomeMessage(input: {
  language: string;
  lastVisitItems: string[];
  visitCount: number;
  lastFeedbackSentiment?: "positive" | "neutral" | "negative" | null;
  template?: string | null;
  memory?: GuestMemoryProjection | null;
  todaySpecial?: string | null;
  currentPartySize?: number | null;
}): string | null {
  const occasionAware = buildOccasionAwareWelcomeMessage({
    language: input.language,
    visitCount: input.visitCount,
    memory: input.memory ?? null,
    lastVisitItems: input.lastVisitItems,
    lastFeedbackSentiment: input.lastFeedbackSentiment,
    todaySpecial: input.todaySpecial,
    currentPartySize: input.currentPartySize,
  });
  if (occasionAware) return occasionAware;

  const items = input.lastVisitItems.filter(Boolean).slice(0, 4);
  if (input.visitCount < 2) return null;
  if (items.length === 0) return null;

  if (input.template?.includes("{items}")) {
    const itemsText =
      input.language.slice(0, 2) === "sr" || input.language.slice(0, 2) === "hr"
        ? items.join(" i ")
        : items.join(", ");
    return input.template.replace("{items}", itemsText);
  }

  return null;
}

/** @deprecated Use buildOccasionAwareWelcomeMessage — kept for direct imports. */
export { buildOccasionAwareWelcomeMessage } from "@/lib/denis/learning/guest-memory/build-occasion-aware-welcome";

/** L2 return-guest welcome — relationship-aware (T0, no LLM). */
export { buildRelationshipWelcomeMessage } from "@/lib/denis/learning/guest-memory/build-relationship-welcome";

export { buildRelationshipEvolutionWelcome } from "@/lib/denis/learning/guest-memory/build-relationship-welcome";

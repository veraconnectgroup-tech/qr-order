import type { GuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";
import { formatPreferenceEvolutionHint } from "@/lib/denis/learning/guest-memory/detect-preference-evolution";

function joinVisitItems(items: string[], language: string): string {
  const lang = language.toLowerCase().slice(0, 2);
  if (lang === "en" || lang === "de") {
    return items.join(", ");
  }
  return items.join(" i ");
}

/** L2 return-guest welcome — relationship-aware (T0, no LLM). */
export function buildRelationshipWelcomeMessage(input: {
  language: string;
  visitCount: number;
  memory?: GuestMemoryProjection | null;
  requireConsent?: boolean;
}): string | null {
  const requireConsent = input.requireConsent ?? true;
  if (
    requireConsent &&
    input.memory &&
    input.memory.hasMemoryConsent === false
  ) {
    return null;
  }
  if (input.visitCount < 2) return null;

  const lang = input.language.toLowerCase().slice(0, 2);
  const currentItems =
    input.memory?.relationship?.currentPreferenceItems ??
    input.memory?.favoriteItems ??
    input.memory?.lastVisitItemNames ??
    [];

  if (input.visitCount >= 3) {
    if (lang === "de") return "Schön, dass Sie wieder da sind!";
    if (lang === "en") return "Welcome back — great to see you again!";
    return "Dobro došli ponovo! Drago nam je što ste opet tu.";
  }

  if (currentItems.length === 0) return null;
  const items = currentItems.filter(Boolean).slice(0, 4);
  const itemsText = joinVisitItems(items, lang);

  if (lang === "de") {
    return `Willkommen zurück! Beim letzten Mal: ${itemsText} — noch einmal?`;
  }
  if (lang === "en") {
    return `Welcome back! Last time you had ${itemsText} — again?`;
  }
  return `Dobro došli ponovo! Prošli put ste imali ${itemsText} — ponovo?`;
}

export function buildRelationshipEvolutionWelcome(input: {
  language: string;
  memory: GuestMemoryProjection;
}): string | null {
  if (!input.memory.hasMemoryConsent || !input.memory.relationship) return null;
  const hint = formatPreferenceEvolutionHint(
    input.memory.relationship.preferenceEvolution,
    input.memory.relationship.currentPreferenceItems,
    input.language
  );
  return hint;
}

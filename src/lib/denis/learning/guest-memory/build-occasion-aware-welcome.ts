import {
  detectGuestOccasions,
  formatOccasionWelcomeOpener,
} from "@/lib/denis/learning/guest-memory/detect-guest-occasions";
import { formatPreferenceEvolutionWelcome } from "@/lib/denis/learning/guest-memory/detect-preference-evolution";
import type { GuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";

function joinVisitItems(items: string[], language: string): string {
  const lang = language.toLowerCase().slice(0, 2);
  if (lang === "en" || lang === "de") {
    return items.join(", ");
  }
  return items.join(" i ");
}

function formatEmotionalRecoveryWelcome(
  language: string,
  favoriteItem?: string | null
): string {
  const lang = language.toLowerCase().slice(0, 2);
  const item = favoriteItem?.trim();

  if (lang === "de") {
    return item
      ? `Schön, dass Sie wieder da sind! Beim letzten Mal lief nicht alles ideal — heute kümmern wir uns extra um Sie. Mögen Sie wieder ${item}?`
      : "Schön, dass Sie wieder da sind! Beim letzten Mal lief nicht alles ideal — heute kümmern wir uns extra um Sie.";
  }
  if (lang === "en") {
    return item
      ? `Welcome back! Last time wasn't perfect — we'll take extra care today. Would you like ${item} again?`
      : "Welcome back! Last time wasn't perfect — we'll take extra care today.";
  }
  return item
    ? `Drago nam je što ste se vratili! Prošli put nije bilo idealno — danas ćemo biti posebno pažljivi. Ponovo ${item}?`
    : "Drago nam je što ste se vratili! Prošli put nije bilo idealno — danas ćemo biti posebno pažljivi.";
}

function formatPositiveMemoryWelcome(
  language: string,
  favoriteItem: string
): string {
  const lang = language.toLowerCase().slice(0, 2);
  if (lang === "de") {
    return `Schön, dass Sie wieder da sind! Beim letzten Mal mochten Sie ${favoriteItem} — wieder?`;
  }
  if (lang === "en") {
    return `Welcome back! You loved ${favoriteItem} last time — again?`;
  }
  return `Drago nam je što ste opet tu! Prošli put vam je ${favoriteItem} bio odličan — ponovo?`;
}

function formatFavoriteReturnWelcome(
  language: string,
  itemsText: string,
  todaySpecial?: string | null
): string {
  const lang = language.toLowerCase().slice(0, 2);
  const special = todaySpecial?.trim();

  if (lang === "de") {
    const base = `Willkommen zurück! Beim letzten Mal: ${itemsText} — noch einmal?`;
    return special ? `${base} Heute als Special: ${special}.` : base;
  }
  if (lang === "en") {
    const base = `Welcome back! Last time you had ${itemsText} — again?`;
    return special ? `${base} Today's special: ${special}.` : base;
  }
  const base = `Dobro došli ponovo! Prošli put ste imali ${itemsText} — ponovo?`;
  return special ? `${base} Danas imamo ${special} — nešto posebno za vas.` : base;
}

/**
 * L2 occasion-aware return welcome — T0, no LLM.
 * Orchestrates occasions, preference evolution, and emotional feedback memory.
 */
export function buildOccasionAwareWelcomeMessage(input: {
  language: string;
  visitCount: number;
  memory?: GuestMemoryProjection | null;
  lastVisitItems?: string[];
  lastFeedbackSentiment?: "positive" | "neutral" | "negative" | null;
  todaySpecial?: string | null;
  currentPartySize?: number | null;
  now?: Date;
  requireConsent?: boolean;
}): string | null {
  const requireConsent = input.requireConsent ?? true;
  const memory = input.memory ?? null;

  if (requireConsent && memory && memory.hasMemoryConsent === false) {
    return null;
  }
  if (input.visitCount < 2) return null;

  const lang = input.language.toLowerCase().slice(0, 2);
  const relationship = memory?.relationship ?? null;
  const currentItems =
    relationship?.currentPreferenceItems ??
    memory?.favoriteItems ??
    memory?.lastVisitItemNames ??
    input.lastVisitItems ??
    [];
  const favoriteItem = currentItems.find(Boolean) ?? null;
  const feedback =
    input.lastFeedbackSentiment ?? memory?.lastFeedbackSentiment ?? null;

  const occasions = detectGuestOccasions({
    relationship,
    visitCount: input.visitCount,
    currentPartySize: input.currentPartySize ?? null,
    now: input.now,
  });

  if (feedback === "negative") {
    return formatEmotionalRecoveryWelcome(input.language, favoriteItem);
  }

  const evolutionWelcome =
    memory?.relationship &&
    formatPreferenceEvolutionWelcome({
      phases: memory.relationship.preferenceEvolution,
      currentItems: memory.relationship.currentPreferenceItems,
      language: input.language,
    });

  const celebrationOpener = formatOccasionWelcomeOpener(
    occasions,
    input.language
  );

  if (occasions.includes("visit_milestone") && input.visitCount >= 5) {
    if (lang === "de") {
      return celebrationOpener
        ? `${celebrationOpener} Schön, dass Sie wieder da sind!`
        : `Schön, dass Sie wieder da sind — schon ${input.visitCount}. Besuch!`;
    }
    if (lang === "en") {
      return celebrationOpener
        ? `${celebrationOpener} Great to see you again!`
        : `Welcome back — visit number ${input.visitCount}!`;
    }
    return celebrationOpener
      ? `${celebrationOpener} Drago nam je što ste opet tu!`
      : `Dobro došli ponovo — ${input.visitCount}. put ste kod nas!`;
  }

  if (evolutionWelcome) {
    return celebrationOpener
      ? `${celebrationOpener} ${evolutionWelcome}`
      : evolutionWelcome;
  }

  if (feedback === "positive" && favoriteItem) {
    const positive = formatPositiveMemoryWelcome(input.language, favoriteItem);
    return celebrationOpener ? `${celebrationOpener} ${positive}` : positive;
  }

  const items = currentItems.filter(Boolean).slice(0, 4);
  if (items.length > 0) {
    const itemsText = joinVisitItems(items, input.language);
    const favoriteReturn = formatFavoriteReturnWelcome(
      input.language,
      itemsText,
      input.todaySpecial
    );
    return celebrationOpener
      ? `${celebrationOpener} ${favoriteReturn}`
      : favoriteReturn;
  }

  if (celebrationOpener) return celebrationOpener;

  if (input.visitCount >= 3) {
    if (lang === "de") return "Schön, dass Sie wieder da sind!";
    if (lang === "en") return "Welcome back — great to see you again!";
    return "Dobro došli ponovo! Drago nam je što ste opet tu.";
  }

  return null;
}

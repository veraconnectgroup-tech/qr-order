import type { PreferredMealPattern } from "@/lib/denis/platform/guest-memory-types";

function formatItemsWithModifiers(
  itemNames: string[],
  modifierPreferences: string[]
): string {
  const items = itemNames.filter(Boolean).slice(0, 4);
  if (items.length === 0) return "";

  const mods = modifierPreferences.slice(0, 2);
  if (mods.length === 0) return items.join(", ");

  const modHint = mods.join(", ");
  if (items.length === 1) {
    return `${items[0]} (${modHint})`;
  }
  return `${items.join(", ")} (${modHint})`;
}

function pickDrinkItem(itemNames: string[]): string | null {
  const drinkHints =
    /spritz|beer|pivo|vino|wine|cocktail|kafa|coffee|cola|juice|sok|limunada|drink/i;
  return itemNames.find((name) => drinkHints.test(name)) ?? itemNames[0] ?? null;
}

function pickMainItem(itemNames: string[]): string | null {
  return itemNames[0]?.trim() || null;
}

/** Deterministic return-guest welcome — T0, no LLM (ADR-005 §7.2, F1). */
export function buildReturnGuestWelcomeMessage(input: {
  language: string;
  lastVisitItems: string[];
  visitCount: number;
  template?: string | null;
  preferredMealPattern?: PreferredMealPattern | null;
  modifierPreferences?: string[];
  lastFeedbackSentiment?: "positive" | "neutral" | "negative" | null;
}): string | null {
  if (input.visitCount < 1) return null;

  const lang = input.language.toLowerCase().slice(0, 2);

  if (input.lastFeedbackSentiment === "positive" && input.visitCount >= 2) {
    if (lang === "de") {
      return "Schön, dass Sie wieder da sind!";
    }
    if (lang === "en") {
      return "Great to have you back!";
    }
    return "Drago nam je što ste opet tu!";
  }

  const items = input.lastVisitItems.filter(Boolean).slice(0, 4);
  if (items.length === 0) return null;

  const itemsText = formatItemsWithModifiers(
    items,
    input.modifierPreferences ?? []
  );
  const pattern = input.preferredMealPattern ?? null;

  if (input.template?.includes("{items}")) {
    return input.template.replace("{items}", itemsText);
  }

  if (pattern === "drinks_only") {
    const drink = pickDrinkItem(items);
    if (drink) {
      if (lang === "de") {
        return `Willkommen zurück! Ihr ${drink}?`;
      }
      if (lang === "en") {
        return `Welcome back! Your ${drink}?`;
      }
      return `Dobrodošli nazad! Vaš ${drink}?`;
    }
  }

  if (pattern === "main_dessert" || pattern === "starter_main_dessert") {
    const main = pickMainItem(items);
    if (main) {
      if (lang === "de") {
        return `Willkommen zurück! Wieder ${main}, oder etwas Neues?`;
      }
      if (lang === "en") {
        return `Welcome back! ${main} again, or try something new?`;
      }
      return `Dobrodošli nazad! Ponovo ${main}, ili da probate nešto novo?`;
    }
  }

  if (lang === "de") {
    return `Willkommen zurück! Beim letzten Mal: ${itemsText} — darf ich das wieder für Sie bringen?`;
  }
  if (lang === "en") {
    return `Welcome back! Last time you had ${itemsText} — shall I bring that again?`;
  }
  return `Dobrodošli nazad! Prošli put ste imali ${itemsText} — da ponovo to isto?`;
}

/** Proactive favorite nudge for returning guests with 3+ visits (F1). */
export function buildReturnGuestFavoriteNudge(input: {
  language: string;
  favoriteItemName: string | null;
  visitCount: number;
}): string | null {
  const name = input.favoriteItemName?.trim();
  if (!name || input.visitCount < 3) return null;

  const lang = input.language.toLowerCase().slice(0, 2);
  if (lang === "de") {
    return `Ihr Lieblings-${name}?`;
  }
  if (lang === "en") {
    return `Your favorite ${name}?`;
  }
  return `Vaš omiljeni ${name}?`;
}

/** Return welcome + loyalty tier line for opted-in guests (Layer 8 / Z1). */
export function buildReturnGuestWelcomeWithLoyalty(input: {
  language: string;
  lastVisitItems: string[];
  visitCount: number;
  template?: string | null;
  preferredMealPattern?: PreferredMealPattern | null;
  modifierPreferences?: string[];
  lastFeedbackSentiment?: "positive" | "neutral" | "negative" | null;
  loyaltyPoints?: number | null;
  loyaltyTierName?: string | null;
  loyaltyTierBadge?: string | null;
  nextTierIn?: number | null;
}): string | null {
  const base = buildReturnGuestWelcomeMessage(input);
  if (!base) return null;
  if (input.visitCount < 2 || !input.loyaltyPoints || input.loyaltyPoints <= 0) {
    return base;
  }

  const lang = input.language.toLowerCase().slice(0, 2);
  const badge = input.loyaltyTierBadge ?? "";
  const tier = input.loyaltyTierName ?? "Bronze";
  const points = input.loyaltyPoints;
  const next = input.nextTierIn ?? 0;

  if (lang === "en") {
    const nextLine =
      next > 0 ? ` ${next} points until the next tier.` : "";
    return `${base} ${badge} You have ${points} ${tier} points.${nextLine}`;
  }

  const nextLine = next > 0 ? ` Još ${next} do sljedećeg tier-a.` : "";
  return `${base} ${badge} Imate ${points} ${tier} bodova.${nextLine}`;
}

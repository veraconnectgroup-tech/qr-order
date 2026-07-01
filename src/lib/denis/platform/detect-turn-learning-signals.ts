import type { GuestIntent } from "@/lib/denis/platform/timeline-types";

export type TurnLearningSignalKind =
  | "menu_gap"
  | "price_resistance"
  | "allergy_coverage"
  | "language_unsupported";

export type TurnLearningSignal =
  | {
      kind: "menu_gap";
      term: string;
      guestMessage: string;
    }
  | {
      kind: "price_resistance";
      guestMessage: string;
      productHint: string | null;
    }
  | {
      kind: "allergy_coverage";
      guestAllergens: string[];
      excludedFoodCount: number;
    }
  | {
      kind: "language_unsupported";
      detected: string;
      guestMessage: string;
    };

export type DetectTurnLearningSignalsInput = {
  guestMessage: string;
  legacyIntent?: string | null;
  guestIntent: GuestIntent | string;
  productNames: string[];
  guestAllergens?: string[];
  excludedFoodCount?: number;
  languageUnsupported?: boolean;
  unsupportedLanguage?: string | null;
  cartChanged: boolean;
  orderSubmitted: boolean;
};

const MENU_GAP_REQUEST =
  /(?:imate|imam|gibt\s+es|habt\s+ihr|haben\s+sie|do\s+you\s+have|have\s+you|da\s+li|could\s+i\s+get|looking\s+for|suche|is\s+there)/i;

const PRICE_INQUIRY =
  /(?:cena|koliko\s+(?:ko[sš]ta|je)|preço|preco|price|kostet|how\s+much|was\s+kostet|€|\$)/i;

const STOPWORDS = [
  "aber",
  "also",
  "and",
  "bitte",
  "can",
  "could",
  "das",
  "dem",
  "den",
  "der",
  "die",
  "do",
  "ein",
  "eine",
  "for",
  "gibt",
  "haben",
  "habt",
  "have",
  "ihr",
  "imate",
  "imam",
  "ist",
  "li",
  "mit",
  "nicht",
  "please",
  "sehr",
  "that",
  "the",
  "und",
  "very",
  "was",
  "what",
  "with",
  "you",
  "your",
] as const;

function isStopword(token: string): boolean {
  return (STOPWORDS as readonly string[]).includes(token);
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").trim();
}

function matchesProduct(term: string, productNames: string[]): boolean {
  const needle = normalizeName(term);
  if (!needle || needle.length < 3) return false;
  return productNames.some((name) => {
    const hay = normalizeName(name);
    return hay.includes(needle) || needle.includes(hay);
  });
}

function extractGapTerm(guestMessage: string, productNames: string[]): string | null {
  const tokens = guestMessage
    .split(/\s+/)
    .map((part) => part.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((part) => part.length >= 4);

  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (isStopword(lower)) continue;
    if (matchesProduct(token, productNames)) continue;
    return token;
  }

  return null;
}

function extractPriceProductHint(guestMessage: string, productNames: string[]): string | null {
  for (const name of productNames) {
    if (guestMessage.toLowerCase().includes(name.toLowerCase())) {
      return name;
    }
  }
  return null;
}

export function isChatLikeTurnIntent(
  legacyIntent: string | null | undefined,
  guestIntent: GuestIntent | string
): boolean {
  if (legacyIntent === "chat" || legacyIntent === "menu_info") return true;
  return guestIntent === "SMALLTALK" || guestIntent === "BROWSE" || guestIntent === "UNKNOWN";
}

/** Pure turn-level operator learning signals (ADR-020 operator layer). */
export function detectTurnLearningSignals(
  input: DetectTurnLearningSignalsInput
): TurnLearningSignal[] {
  const signals: TurnLearningSignal[] = [];
  const guestMessage = input.guestMessage.trim();
  if (!guestMessage) return signals;

  if (
    isChatLikeTurnIntent(input.legacyIntent, input.guestIntent) &&
    (MENU_GAP_REQUEST.test(guestMessage) || /\?\s*$/.test(guestMessage))
  ) {
    const term = extractGapTerm(guestMessage, input.productNames);
    if (term) {
      signals.push({ kind: "menu_gap", term, guestMessage });
    }
  }

  if (
    PRICE_INQUIRY.test(guestMessage) &&
    !input.cartChanged &&
    !input.orderSubmitted
  ) {
    signals.push({
      kind: "price_resistance",
      guestMessage,
      productHint: extractPriceProductHint(guestMessage, input.productNames),
    });
  }

  const allergens = (input.guestAllergens ?? [])
    .map((value) => value.trim())
    .filter(Boolean);
  const excludedFoodCount = input.excludedFoodCount ?? 0;
  if (allergens.length > 0 && excludedFoodCount >= 3) {
    signals.push({
      kind: "allergy_coverage",
      guestAllergens: allergens,
      excludedFoodCount,
    });
  }

  if (input.languageUnsupported) {
    signals.push({
      kind: "language_unsupported",
      detected: input.unsupportedLanguage?.trim() || "unknown",
      guestMessage,
    });
  }

  return signals;
}

import type { AiCatalog, AiCatalogProduct } from "@/lib/ai/catalog/catalog-types";
import type { AiProposedItem } from "@/lib/ai/ordering/draft-types";
import { levenshteinDistance, normalizeFuzzyText } from "@/lib/ai/catalog/fuzzy-match-engine";
import { isOrderPlacementMessage } from "@/lib/ai/ordering/order-message-backfill";

/**
 * Cross-language drink classes — guards against the LLM mapping a requested
 * drink type onto an unrelated product (e.g. "weizen" → Pinot Grigio when the
 * menu has no beer at all).
 */
const DRINK_CLASS_KEYWORDS: Record<string, string[]> = {
  beer: [
    "pivo",
    "piva",
    "pive",
    "beer",
    "bier",
    "pils",
    "pilsner",
    "weizen",
    "weissbier",
    "lager",
    "radler",
  ],
  wine: ["vino", "vina", "wine", "wein", "prosecco", "rose", "spritzer"],
  coffee: [
    "kafa",
    "kava",
    "kafu",
    "coffee",
    "kaffee",
    "espresso",
    "latte",
    "cappuccino",
    "macchiato",
  ],
  juice: ["sok", "sokovi", "juice", "saft"],
  tea: ["caj", "tea", "tee"],
  soft: ["cola", "kola", "sprite", "fanta", "limunada", "lemonade", "limonade", "soda"],
  water: ["voda", "vode", "vodu", "water", "wasser", "kisela", "mineralna"],
};

const GUARD_STOP_WORDS = new Set([
  "jedno",
  "jedna",
  "jedan",
  "veliko",
  "velika",
  "malo",
  "mala",
  "molim",
  "bitte",
  "please",
  "daj",
  "moze",
  "hocu",
  "zelim",
  "want",
  "give",
  "one",
  "two",
  "und",
  "and",
  "ein",
  "eine",
]);

function textTokens(text: string): string[] {
  return normalizeFuzzyText(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 3 && !GUARD_STOP_WORDS.has(token));
}

function classesInText(text: string): Set<string> {
  const tokens = textTokens(text);
  const classes = new Set<string>();
  for (const [cls, keywords] of Object.entries(DRINK_CLASS_KEYWORDS)) {
    if (tokens.some((token) => keywords.some((kw) => token === kw || token.startsWith(kw)))) {
      classes.add(cls);
    }
  }
  return classes;
}

function productClasses(product: AiCatalogProduct): Set<string> {
  const haystack = normalizeFuzzyText(
    `${product.name} ${(product.tags ?? []).join(" ")} ${product.drinkFamily ?? ""}`
  );
  const classes = new Set<string>();
  for (const [cls, keywords] of Object.entries(DRINK_CLASS_KEYWORDS)) {
    if (keywords.some((kw) => haystack.includes(kw))) classes.add(cls);
  }
  if (product.drinkFamily && DRINK_CLASS_KEYWORDS[product.drinkFamily]) {
    classes.add(product.drinkFamily);
  }
  return classes;
}

function messageNamesProduct(message: string, product: AiCatalogProduct): boolean {
  const messageTokens = textTokens(message);
  if (!messageTokens.length) return false;

  const productTokens = normalizeFuzzyText(product.name)
    .split(/\s+/)
    .filter((word) => word.length >= 3);

  for (const token of messageTokens) {
    for (const word of productTokens) {
      if (word.includes(token) || token.includes(word)) return true;
      if (levenshteinDistance(token, word) <= 1) return true;
    }
  }
  return false;
}

export type ProposedItemGuardResult = {
  items: AiProposedItem[];
  /** Guest-named terms that exist in no catalog product (e.g. "weizen"). */
  unavailableTerms: string[];
  /**
   * Names of catalog products that actually match the requested class,
   * populated when the venue DOES serve that class but the LLM proposed a
   * mismatched product (e.g. wine instead of beer) — lets the caller offer
   * the real options instead of silently dropping with no explanation.
   */
  classMatchAlternatives: string[];
  droppedCount: number;
};

/**
 * Deterministic post-LLM guard: when the guest explicitly asks for a drink
 * class, drop LLM-proposed items that neither match the message text nor the
 * requested class — never silently substitute an unrelated product. Applies
 * both when the venue doesn't serve that class at all AND when it does but
 * the LLM proposed the wrong product (e.g. "pivo" → Pinot Grigio when beer
 * is actually on the menu).
 */
export function guardProposedItemsAgainstMenu(input: {
  proposedItems: AiProposedItem[];
  catalog: AiCatalog;
  userMessage: string;
}): ProposedItemGuardResult {
  const passthrough: ProposedItemGuardResult = {
    items: input.proposedItems,
    unavailableTerms: [],
    classMatchAlternatives: [],
    droppedCount: 0,
  };

  if (!input.proposedItems.length) return passthrough;
  if (!isOrderPlacementMessage(input.userMessage)) return passthrough;

  const requestedClasses = classesInText(input.userMessage);
  if (!requestedClasses.size) return passthrough;

  const products = Object.values(input.catalog.catalog);
  const servedClasses = new Set<string>();
  for (const product of products) {
    for (const cls of productClasses(product)) servedClasses.add(cls);
  }

  const kept: AiProposedItem[] = [];
  let droppedCount = 0;

  for (const item of input.proposedItems) {
    const product = input.catalog.catalog[item.productId];
    if (!product) {
      kept.push(item);
      continue;
    }
    if (messageNamesProduct(input.userMessage, product)) {
      kept.push(item);
      continue;
    }
    const itemClasses = productClasses(product);
    if ([...itemClasses].some((cls) => requestedClasses.has(cls))) {
      kept.push(item);
      continue;
    }
    droppedCount += 1;
  }

  if (!droppedCount) return passthrough;

  const unavailableClasses = [...requestedClasses].filter(
    (cls) => !servedClasses.has(cls)
  );
  const messageTokens = textTokens(input.userMessage);
  const unavailableTerms = messageTokens.filter((token) =>
    unavailableClasses.some((cls) =>
      DRINK_CLASS_KEYWORDS[cls]!.some((kw) => token === kw || token.startsWith(kw))
    )
  );

  const servedRequestedClasses = [...requestedClasses].filter((cls) =>
    servedClasses.has(cls)
  );
  const classMatchAlternatives = servedRequestedClasses.length
    ? [
        ...new Set(
          products
            .filter((product) =>
              [...productClasses(product)].some((cls) =>
                servedRequestedClasses.includes(cls)
              )
            )
            .map((product) => product.name)
        ),
      ].slice(0, 4)
    : [];

  return {
    items: kept,
    unavailableTerms: [...new Set(unavailableTerms)],
    classMatchAlternatives,
    droppedCount,
  };
}

/** Honest guest note when a requested item class is not on the menu. */
export function unavailableItemsGuestNote(
  terms: string[],
  language: string
): string {
  const list = terms.join(", ");
  const lang = language.toLowerCase().slice(0, 2);
  if (lang === "de") {
    return `Wir haben leider kein ${list} auf der Karte. Sag mir, was du stattdessen möchtest — ich zeige dir gern die Alternativen.`;
  }
  if (lang === "en") {
    return `We don't have ${list} on the menu. Tell me what you'd like instead — happy to suggest alternatives.`;
  }
  return `Nažalost nemamo ${list} u ponudi. Reci šta želiš umesto toga — mogu da predložim alternative.`;
}

/** Honest guest note when the venue serves the requested class but the proposed item was wrong. */
export function classMismatchGuestNote(
  alternatives: string[],
  language: string
): string {
  const list = alternatives.join(", ");
  const lang = language.toLowerCase().slice(0, 2);
  if (lang === "de") {
    return `Das war nicht ganz richtig — wir haben: ${list}. Was davon möchtest du?`;
  }
  if (lang === "en") {
    return `That wasn't quite right — we have: ${list}. Which one would you like?`;
  }
  return `Nisam dobro pogodio — imamo: ${list}. Koje od ovoga želiš?`;
}

import { searchCatalogProducts } from "@/lib/ai/catalog/catalog-search";
import type { AiCatalogProduct } from "@/lib/ai/catalog/catalog-types";
import type { AiOrderDraft } from "@/lib/ai/ordering/draft-types";
import { processProposedItems } from "@/lib/ai/ordering/draft-engine";

const SUBSTITUTION_PATTERN =
  /\b(?:umesto|instead of|statt)\s+(.+?)(?:\s*[,.]|$)|(.+?)\s+(?:umesto|instead of|statt)\s+(.+)/i;

const FRIES_WORD =
  /\b(pomfri\w*|pones\w*|pommes|fries|kartoffel\s*salat\w*|kartoffelsalat|prilog\w*|garnir\w*|beilage\w*|salat\w*)\b/i;

const GENERIC_BEER_SEGMENT =
  /^(?:jedn[oa]\s+)?(?:pivo|piva|beer|bier)(?:\s|$)/i;

const SIDE_SWAP_HINT =
  /\b(pomfri\w*|pones\w*|pommes|fries|salat\w*|kartoffel|prilog|garnir|beilage|krompir)\b/i;

export type GuestSubstitutionRequest = {
  requested: string;
  insteadOf: string;
  rawPhrase: string;
};

export type GuestModifierRequest = {
  modifier: string;
  rawPhrase: string;
};

/** Product-for-product swap in cart — "Chicken umesto Beef", not side garnish. */
export type GuestCartSwapRequest = {
  requested: string;
  insteadOf: string;
  rawPhrase: string;
};

export type GuestRemovalRequest = {
  target: string;
  rawPhrase: string;
};

const EXTRA_MODIFIER_PATTERN =
  /\b(?:sa|with|mit)\s+(?:extra|ekstra)\s+([^,.!?]+)/i;

const COOKING_MODIFIER_PATTERN =
  /\b(medium\s+rare|medium|well\s+done|rare|bloody|malo\s+pe[cč]eno|dobro\s+pe[cč]eno)\b/i;

function pushUniqueModifier(out: string[], modifier: string) {
  const normalized = modifier.trim().toLowerCase();
  if (!normalized) return;
  if (out.some((entry) => entry.toLowerCase() === normalized)) return;
  out.push(modifier.trim());
}

/** Collect all modifier phrases on a segment (bez luka, extra sir, medium rare). */
export function parseGuestModifiers(segment: string): string[] {
  const text = segment.trim();
  if (!text) return [];

  const modifiers: string[] = [];

  const bezMatch = text.match(/\b(?:ali\s+)?bez\s+([^,.!?]+)/i);
  if (bezMatch?.[1]) {
    pushUniqueModifier(modifiers, `bez ${bezMatch[1].trim()}`);
  }

  const withoutMatch = text.match(/\bwithout\s+([^,.!?]+)/i);
  if (withoutMatch?.[1]) {
    pushUniqueModifier(modifiers, `without ${withoutMatch[1].trim()}`);
  }

  const ohneMatch = text.match(/\bohne\s+([^,.!?]+)/i);
  if (ohneMatch?.[1]) {
    pushUniqueModifier(modifiers, `ohne ${ohneMatch[1].trim()}`);
  }

  const extraMatch = text.match(EXTRA_MODIFIER_PATTERN);
  if (extraMatch?.[1]) {
    pushUniqueModifier(modifiers, `extra ${extraMatch[1].trim()}`);
  }

  const cookingMatch = text.match(COOKING_MODIFIER_PATTERN);
  if (cookingMatch?.[0]) {
    pushUniqueModifier(modifiers, cookingMatch[0].trim());
  }

  const neMatch = text.match(
    /\bne\s+(ljuto|pijaci|slatko|slano|luk|luka|mesa|meso|onion|garlic)\b/i
  );
  if (neMatch?.[0]) {
    pushUniqueModifier(modifiers, `ne ${neMatch[1]!.toLowerCase()}`);
  }

  return modifiers;
}

export function parseGuestModifier(segment: string): GuestModifierRequest | null {
  const modifiers = parseGuestModifiers(segment);
  if (!modifiers.length) return null;
  return { modifier: modifiers.join("; "), rawPhrase: segment.trim() };
}

const MODIFIER_STRIP_PATTERNS = [
  /\b(?:ali\s+)?bez\s+[^,.!?]+/gi,
  /\bwithout\s+[^,.!?]+/gi,
  /\bohne\s+[^,.!?]+/gi,
  EXTRA_MODIFIER_PATTERN,
  COOKING_MODIFIER_PATTERN,
  /\bne\s+(?:ljuto|pijaci|slatko|slano|luk|luka|mesa|meso|onion|garlic)\b/gi,
];

/** Strip modifier phrases so product search sees "Burger" not "Burger ali bez luka". */
export function stripGuestModifierPhrase(segment: string): string {
  let text = segment.trim();
  for (const pattern of MODIFIER_STRIP_PATTERNS) {
    text = text.replace(pattern, "");
  }
  return text.replace(/\s+ali\s*$/i, "").replace(/\s+/g, " ").trim();
}

const NEGATION_SWAP_PATTERN =
  /\b(?:ne|not|nicht)\s+(.+?)\s+(?:nego|ve[cć]|but|sondern)\s+(.+)/i;

function normalizeCartSwapSegment(segment: string): string {
  return segment
    .trim()
    .replace(/^(?:zapravo|actually|eigentlich),?\s+/i, "")
    .trim();
}

/** Mid-order swap — "ne Pilsner nego Weißbier", "not beer but wine". */
export function parseGuestNegationSwap(
  segment: string
): GuestCartSwapRequest | null {
  const text = normalizeCartSwapSegment(segment);
  const match = text.match(NEGATION_SWAP_PATTERN);
  if (!match?.[1] || !match[2]) return null;

  const insteadOf = match[1].trim();
  const requested = match[2].trim();
  if (insteadOf.length < 2 || requested.length < 2) return null;

  const sideSwap =
    SIDE_SWAP_HINT.test(requested) || SIDE_SWAP_HINT.test(insteadOf);
  if (sideSwap) return null;

  return {
    requested,
    insteadOf,
    rawPhrase: match[0],
  };
}

export function parseGuestCartSwap(segment: string): GuestCartSwapRequest | null {
  const negationSwap = parseGuestNegationSwap(segment);
  if (negationSwap) return negationSwap;

  const sub = parseGuestSubstitution(segment);
  if (!sub) return null;

  const sideSwap =
    SIDE_SWAP_HINT.test(sub.requested) || SIDE_SWAP_HINT.test(sub.insteadOf);
  if (sideSwap) return null;

  return {
    requested: sub.requested,
    insteadOf: sub.insteadOf,
    rawPhrase: sub.rawPhrase,
  };
}

export function parseGuestRemoval(message: string): GuestRemovalRequest | null {
  const text = message.trim();
  if (!text || text.length > 160) return null;

  const patterns: Array<{ regex: RegExp; group: number }> = [
    { regex: /\b(?:odustani|odustanem)\s+(?:od|from)\s+(.+)/i, group: 1 },
    { regex: /\b(?:cancel|storniraj|ukloni|remove|obri[sš]i)\s+(.+)/i, group: 1 },
    {
      regex: /\bne\s+(?:treba|želim|zelim|ho[cć]u|hocu)\s+(.+)/i,
      group: 1,
    },
  ];

  for (const { regex, group } of patterns) {
    const match = text.match(regex);
    const target = match?.[group]?.trim();
    if (target && target.length >= 2) {
      return { target, rawPhrase: match![0] };
    }
  }

  return null;
}

function lineMatchesTarget(lineName: string, query: string): boolean {
  const line = lineName.trim().toLowerCase();
  const needle = query.trim().toLowerCase();
  if (!needle) return false;
  if (line.includes(needle) || needle.includes(line)) return true;
  const prefix = needle.slice(0, Math.min(4, needle.length));
  return prefix.length >= 3 && line.split(/\s+/).some((word) => word.startsWith(prefix));
}

/** Swap cart line product when guest says "Chicken umesto Beef". */
export function applyGuestCartSwap(
  draft: AiOrderDraft,
  swap: GuestCartSwapRequest,
  catalog: Record<string, AiCatalogProduct>
): { draft: AiOrderDraft; swapped: boolean } {
  const idx = draft.items.findIndex((line) =>
    lineMatchesTarget(line.productName, swap.insteadOf)
  );
  if (idx < 0) return { draft, swapped: false };

  const candidates = searchCatalogProducts(catalog, swap.requested, 8);
  const replacement = candidates[0];
  if (!replacement) return { draft, swapped: false };

  const processed = processProposedItems(
    draft,
    {
      menuText: "",
      productMap: {},
      catalog,
      currency: "EUR",
      cachedAt: new Date().toISOString(),
    },
    [
      {
        productId: replacement.id,
        quantity: draft.items[idx]!.quantity,
        modifierIds: [...draft.items[idx]!.modifierIds],
        serveSize: draft.items[idx]!.serveSize,
        notes: draft.items[idx]!.notes,
      },
    ],
    { userMessage: swap.rawPhrase }
  );

  const nextItems = [...processed.draft.items];
  if (nextItems.length <= draft.items.length) return { draft, swapped: false };

  const newLine = nextItems[nextItems.length - 1]!;
  const items = draft.items.filter((_, i) => i !== idx);
  items.splice(idx, 0, newLine);

  return {
    draft: {
      ...processed.draft,
      items,
      cartRevision: draft.cartRevision + 1,
    },
    swapped: true,
  };
}

/** Remove cart line when guest says "Odustani od Pilsnera". */
export function applyGuestRemoval(
  draft: AiOrderDraft,
  removal: GuestRemovalRequest
): { draft: AiOrderDraft; removed: boolean } {
  const idx = draft.items.findIndex((line) =>
    lineMatchesTarget(line.productName, removal.target)
  );
  if (idx < 0) return { draft, removed: false };

  const items = draft.items.filter((_, i) => i !== idx);
  return {
    draft: {
      ...draft,
      items,
      cartRevision: draft.cartRevision + 1,
    },
    removed: true,
  };
}

export function parseGuestSubstitution(segment: string): GuestSubstitutionRequest | null {
  const text = segment.trim();
  if (!text) return null;

  const umestoMatch = text.match(
    /\b(.+?)\s+umesto\s+(.+?)(?:\s*[,.]|$)/i
  );
  if (umestoMatch?.[1] && umestoMatch[2]) {
    const requested = umestoMatch[1].trim();
    const insteadOf = umestoMatch[2].trim();
    if (requested.length >= 2 && insteadOf.length >= 2) {
      return { requested, insteadOf, rawPhrase: umestoMatch[0] };
    }
  }

  const insteadMatch = text.match(/\b(?:instead of|statt)\s+(.+)/i);
  if (insteadMatch?.[1]) {
    const insteadOf = insteadMatch[1].trim();
    const requested = text
      .replace(/\b(?:instead of|statt)\s+.+$/i, "")
      .trim();
    if (requested.length >= 2 && insteadOf.length >= 2) {
      return { requested, insteadOf, rawPhrase: text };
    }
  }

  if (SUBSTITUTION_PATTERN.test(text)) {
    return null;
  }

  return null;
}

export function isGenericBeerSegment(segment: string): boolean {
  const normalized = segment.trim().toLowerCase();
  if (!normalized) return false;
  if (/\b(pilsner|weizen|lager|radler|kisel\w*|cola|sprite)\b/i.test(normalized)) {
    return false;
  }
  return GENERIC_BEER_SEGMENT.test(normalized);
}

export function substitutionReplacesFries(sub: GuestSubstitutionRequest): boolean {
  return FRIES_WORD.test(sub.insteadOf);
}

/** Guest-facing plan when auto-modifiers are uncertain. */
export function drinkClarifySnippet(language: string): string {
  const lang = language.toLowerCase().slice(0, 2);
  if (lang === "de") {
    return "Zum Getränk: Welches Bier möchten Sie — z. B. Pilsner oder Weizen, 0.3L oder 0.5L?";
  }
  if (lang === "en") {
    return "For the drink — which type would you like, e.g. Pilsner or Weizen, 0.3L or 0.5L?";
  }
  return "Za piće — koji tip želite? Na primer Pilsner ili Weizen, 0.3L ili 0.5L.";
}

export function buildSubstitutionNegotiationMessage(
  language: string,
  input: {
    cartSummary: string | null;
    substitution: GuestSubstitutionRequest | null;
    needsDrinkClarify: boolean;
    waiterEscalationOffered?: boolean;
  }
): string {
  const lang = language.toLowerCase().slice(0, 2);
  const cart = input.cartSummary?.trim();
  const sub = input.substitution;

  if (lang === "sr" || lang === "hr") {
    const parts: string[] = [];

    if (cart) {
      parts.push(`U redu — dodajem ${cart}.`);
    }

    if (sub) {
      parts.push(
        `Za zamenu (${sub.requested} umesto ${sub.insteadOf}) proveravam sa kuhinjom — staviću napomenu uz porudžbinu.`
      );
      parts.push(
        "Ako želite, mogu odmah da pozovem konobara da potvrdi da li je moguće."
      );
    }

    if (input.needsDrinkClarify) {
      parts.push(drinkClarifySnippet("sr"));
    }

    if (!parts.length) {
      return "Razumem. Recite mi šta tačno želite, pa ću složiti porudžbinu korak po korak.";
    }

    return parts.join(" ");
  }

  if (lang === "de") {
    const parts: string[] = [];
    if (cart) parts.push(`Alles klar — ich nehme ${cart} auf.`);
    if (sub) {
      parts.push(
        `Für die Änderung (${sub.requested} statt ${sub.insteadOf}) gebe ich eine Notiz mit — die Küche muss das bestätigen.`
      );
      parts.push("Soll ich den Service rufen, damit wir das kurz klären?");
    }
    if (input.needsDrinkClarify) {
      parts.push(drinkClarifySnippet("de"));
    }
    return (
      parts.join(" ") ||
      "Verstanden. Sagen Sie mir bitte, was Sie möchten, dann gehen wir Schritt für Schritt vor."
    );
  }

  const parts: string[] = [];
  if (cart) parts.push(`Got it — adding ${cart}.`);
  if (sub) {
    parts.push(
      `For the swap (${sub.requested} instead of ${sub.insteadOf}) I'll add a note — the kitchen needs to confirm.`
    );
    parts.push("I can call a waiter now to double-check if you'd like.");
  }
  if (input.needsDrinkClarify) {
    parts.push(drinkClarifySnippet("en"));
  }
  return (
    parts.join(" ") ||
    "Understood. Tell me what you'd like and we'll build the order step by step."
  );
}

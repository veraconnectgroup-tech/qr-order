import { searchCatalogProducts } from "@/lib/ai/catalog/catalog-search";
import type { AiCatalog, AiCatalogProduct } from "@/lib/ai/catalog/catalog-types";
type ChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
};
import { processProposedItems } from "@/lib/ai/ordering/draft-engine";
import type {
  AiOrderDraft,
  AiProposedItem,
  ValidatedCartAction,
} from "@/lib/ai/ordering/draft-types";
import {
  formatServeSizeOption,
  inferServeSizeFromMessage,
  resolveImplicitServeSizeForProduct,
} from "@/lib/ai/ordering/serve-size-logic";
import { isGenericCategorySegment } from "@/lib/ai/ordering/category-order-logic";
import { isGuestFinalConfirm } from "@/lib/ai/ordering/order-flow";
import {
  buildSubstitutionNegotiationMessage,
  drinkClarifySnippet,
  isGenericBeerSegment,
  parseGuestSubstitution,
  substitutionReplacesFries,
  type GuestSubstitutionRequest,
} from "@/lib/denis/cognition/conversation/guest-substitution";

const ORDER_PREFIX =
  /^(daj\s+mi|daj|ho[ćc]u|hocu|mo[žz]e|želim|zelim|give\s+me|i\s+want|can\s+i\s+get|molim(\s+te)?|please|i\s+need)\s+/i;

const MULTI_ITEM_SPLIT = /\s+(?:i|und|and)\s+|,\s*/i;

const FRIES_PATTERN = /pomfrit|pones|pommes|fries|kartoffel/i;

const TYPED_DRINK_PATTERN =
  /\b(pilsner|weizen|lager|radler|kisel\w*|cola|sprite|sok|juice|vino|wine|wein|espresso|latte)\b/i;

const GENERIC_BEER_INLINE =
  /\b(?:jedn[oa]\s+)?(?:pivo|piva|beer|bier)\b/i;

function normalizeSegment(segment: string) {
  return segment.trim().replace(/\s+/g, " ");
}

function segmentTokens(segment: string) {
  return normalizeSegment(segment)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 3);
}

export function isOrderPlacementMessage(message: string): boolean {
  const text = message.trim();
  if (!text || isGuestFinalConfirm(text)) return false;
  if (ORDER_PREFIX.test(text)) return true;
  if (MULTI_ITEM_SPLIT.test(text) && text.length >= 12) return true;
  return /\b(pivo|pilsner|lager|radler|burger|kisel|cola|pizza|steak|salat|sendvič|sendvic|vino|wine|wein|kafa|coffee|espresso|limunada|sok|juice)\b/i.test(
    text
  );
}

export function splitOrderMessageSegments(message: string): string[] {
  const stripped = message.trim().replace(ORDER_PREFIX, "").trim();
  if (!stripped) return [];

  const parts = stripped
    .split(MULTI_ITEM_SPLIT)
    .map((part) => normalizeSegment(part))
    .filter((part) => part.length >= 2);

  return parts.length ? parts : [stripped];
}

function scoreSegmentMatch(segment: string, product: AiCatalogProduct): number {
  const normalizedSegment = normalizeSegment(segment).toLowerCase();
  const productName = product.name.toLowerCase();
  if (normalizedSegment.length >= 3 && productName === normalizedSegment) {
    return 100;
  }

  if (isGenericCategorySegment(segment)) return 0;

  const tokens = segmentTokens(segment).filter(
    (t) =>
      ![
        "pivo",
        "piva",
        "beer",
        "bier",
        "veliko",
        "velika",
        "malo",
        "mala",
        "jedno",
        "jedna",
        "jedan",
      ].includes(t)
  );
  if (!tokens.length) return 0;

  const haystack = product.name.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) score += 12;
    if (haystack.split(/\s+/).some((word) => word.startsWith(token))) {
      score += 6;
    }
  }
  return score;
}

function pickProductForSegment(
  segment: string,
  catalog: Record<string, AiCatalogProduct>
): AiCatalogProduct | null {
  const candidates = searchCatalogProducts(catalog, segment, 12);
  if (!candidates.length) return null;

  let best: { product: AiCatalogProduct; score: number } | null = null;
  for (const product of candidates) {
    const score = scoreSegmentMatch(segment, product);
    if (score <= 0) continue;
    if (!best || score > best.score) {
      best = { product, score };
    }
  }

  return best?.product ?? null;
}

function inferServeSizeFromSegment(
  segment: string,
  product: AiCatalogProduct
): string | null {
  return inferServeSizeFromMessage(segment, product);
}

function inferModifierIdsFromSegment(
  segment: string,
  product: AiCatalogProduct,
  substitution: GuestSubstitutionRequest | null
): string[] {
  const normalized = segment.toLowerCase();
  const ids: string[] = [];

  for (const group of product.modifierGroups) {
    for (const mod of group.modifiers) {
      const modName = mod.name.toLowerCase();
      if (normalized.includes(modName)) {
        ids.push(mod.id);
      }
    }
  }

  const skipFriesDefault =
    substitution != null && substitutionReplacesFries(substitution);

  if (FRIES_PATTERN.test(normalized) && !skipFriesDefault) {
    for (const group of product.modifierGroups) {
      for (const mod of group.modifiers) {
        if (FRIES_PATTERN.test(mod.name)) {
          if (!ids.includes(mod.id)) ids.push(mod.id);
        }
      }
    }
  }

  return ids;
}

function segmentToProposedItem(
  segment: string,
  catalog: AiCatalog
): { item: AiProposedItem | null; substitution: GuestSubstitutionRequest | null } {
  const substitution = parseGuestSubstitution(segment);
  const product = pickProductForSegment(segment, catalog.catalog);
  if (!product) {
    return { item: null, substitution };
  }

  return {
    item: {
      productId: product.id,
      quantity: 1,
      modifierIds: inferModifierIdsFromSegment(segment, product, substitution),
      serveSize: inferServeSizeFromSegment(segment, product),
      // Kitchen note is added after guest confirms substitution (ADR-033 obligation gap).
      notes: "",
    },
    substitution,
  };
}

export type OrderBackfillMeta = {
  substitution: GuestSubstitutionRequest | null;
  needsDrinkClarify: boolean;
};

function emptyBackfillMeta(): OrderBackfillMeta {
  return { substitution: null, needsDrinkClarify: false };
}

function mergeOrderBackfillMeta(
  a: OrderBackfillMeta,
  b: OrderBackfillMeta
): OrderBackfillMeta {
  return {
    substitution: a.substitution ?? b.substitution,
    needsDrinkClarify: a.needsDrinkClarify || b.needsDrinkClarify,
  };
}

function messageNeedsDrinkClarify(message: string, segments: string[]): boolean {
  if (segments.some((segment) => isGenericBeerSegment(segment))) {
    return true;
  }
  const text = message.trim();
  if (!text || TYPED_DRINK_PATTERN.test(text)) return false;
  return GENERIC_BEER_INLINE.test(text);
}

/** Parse gaps from guest line even when cart already has items (LLM path). */
export function extractOrderMessageMeta(message: string): OrderBackfillMeta {
  const text = message.trim();
  if (!text || !isOrderPlacementMessage(text)) {
    return emptyBackfillMeta();
  }

  const segments = splitOrderMessageSegments(text);
  let substitution: GuestSubstitutionRequest | null = null;

  for (const segment of segments) {
    const parsed = parseGuestSubstitution(segment);
    if (parsed && !substitution) {
      substitution = parsed;
    }
  }

  return {
    substitution,
    needsDrinkClarify: messageNeedsDrinkClarify(text, segments),
  };
}

export function draftHasDrinkInCart(draft: AiOrderDraft): boolean {
  return draft.items.some((line) => {
    const name = line.productName.trim();
    if (TYPED_DRINK_PATTERN.test(name)) return true;
    if (line.menuSection === "drinks" && !isGenericBeerSegment(name)) {
      return true;
    }
    return false;
  });
}

/** Append missing drink/substitution clarify to recap — Denis never stays silent on gaps. */
export function appendOrderGapClarify(
  baseMessage: string,
  language: string,
  draft: AiOrderDraft,
  meta: OrderBackfillMeta
): string {
  const extras: string[] = [];

  if (meta.needsDrinkClarify && !draftHasDrinkInCart(draft)) {
    extras.push(drinkClarifySnippet(language));
  }

  if (
    meta.substitution &&
    !draft.items.some((line) =>
      line.notes?.toLowerCase().includes(meta.substitution!.insteadOf.toLowerCase())
    )
  ) {
    extras.push(
      `Napomena: ${meta.substitution.requested} umesto ${meta.substitution.insteadOf} — proveravam sa kuhinjom.`
    );
  }

  if (!extras.length) return baseMessage;
  return `${baseMessage.trim()}\n\n${extras.join("\n")}`;
}

export function findLastOrderPlacementUserMessage(
  messages: ChatHistoryMessage[]
): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const row = messages[i];
    if (row.role !== "user") continue;
    if (isOrderPlacementMessage(row.content)) {
      return row.content;
    }
  }
  return null;
}

/** Last guest line before confirm — used when LLM narrated the item but draft stayed empty. */
export function findLastNonConfirmUserMessage(
  messages: ChatHistoryMessage[]
): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const row = messages[i];
    if (row.role !== "user") continue;
    const text = row.content.trim();
    if (!text || isGuestFinalConfirm(text)) continue;
    return text;
  }
  return null;
}

/**
 * When the LLM recaps an order but omits proposedItems, rebuild draft from catalog search.
 */
export function backfillDraftFromOrderMessage(
  draft: AiOrderDraft,
  catalog: AiCatalog,
  message: string,
  options?: { requirePlacementPattern?: boolean }
): {
  draft: AiOrderDraft;
  cartActions: ValidatedCartAction[];
  meta: OrderBackfillMeta;
} {
  const metaFromMessage = extractOrderMessageMeta(message);
  if (draft.items.length > 0 || draft.pending) {
    return { draft, cartActions: [], meta: metaFromMessage };
  }
  const requirePlacementPattern = options?.requirePlacementPattern ?? true;
  if (requirePlacementPattern && !isOrderPlacementMessage(message)) {
    return { draft, cartActions: [], meta: metaFromMessage };
  }

  const segments = splitOrderMessageSegments(message);
  const proposed: AiProposedItem[] = [];
  const usedProductIds = new Set<string>();
  let substitution: GuestSubstitutionRequest | null = null;
  let needsDrinkClarify = false;

  for (const segment of segments) {
    if (isGenericBeerSegment(segment)) {
      needsDrinkClarify = true;
      continue;
    }

    const parsed = segmentToProposedItem(segment, catalog);
    if (parsed.substitution && !substitution) {
      substitution = parsed.substitution;
    }

    const item = parsed.item;
    if (!item || usedProductIds.has(item.productId)) continue;
    proposed.push(item);
    usedProductIds.add(item.productId);
  }

  if (!proposed.length) {
    return {
      draft,
      cartActions: [],
      meta: { substitution, needsDrinkClarify },
    };
  }

  const processed = processProposedItems(draft, catalog, proposed, {
    userMessage: message,
  });

  return {
    draft: processed.draft,
    cartActions: processed.cartActions,
    meta: { substitution, needsDrinkClarify },
  };
}

/** Add a typed drink line when cart already has food (gap-resolved drink reply). */
export function backfillTypedDrinkAddition(
  draft: AiOrderDraft,
  catalog: AiCatalog,
  userMessage: string
): {
  draft: AiOrderDraft;
  cartActions: ValidatedCartAction[];
} {
  const text = userMessage.trim();
  if (!text || !TYPED_DRINK_PATTERN.test(text)) {
    return { draft, cartActions: [] };
  }
  if (draftHasDrinkInCart(draft)) {
    return { draft, cartActions: [] };
  }

  const parsed = segmentToProposedItem(text, catalog);
  if (!parsed.item) {
    return { draft, cartActions: [] };
  }

  const product = catalog.catalog[parsed.item.productId];
  if (product && !parsed.item.serveSize) {
    const implicitSize = resolveImplicitServeSizeForProduct(product);
    if (implicitSize) {
      parsed.item.serveSize = implicitSize;
    }
  }

  const processed = processProposedItems(draft, catalog, [parsed.item], {
    userMessage: text,
  });

  return {
    draft: processed.draft,
    cartActions: processed.cartActions,
  };
}

export function maybeBackfillOrderDraft(
  draft: AiOrderDraft,
  catalog: AiCatalog,
  userMessage: string,
  priorMessages: ChatHistoryMessage[]
): {
  draft: AiOrderDraft;
  cartActions: ValidatedCartAction[];
  meta: OrderBackfillMeta;
} {
  const confirming = isGuestFinalConfirm(userMessage);
  const source = confirming
    ? (findLastOrderPlacementUserMessage(priorMessages) ??
      findLastNonConfirmUserMessage(priorMessages))
    : isOrderPlacementMessage(userMessage)
      ? userMessage
      : null;

  if (!source) {
    return {
      draft,
      cartActions: [],
      meta: extractOrderMessageMeta(userMessage),
    };
  }

  const backfill = backfillDraftFromOrderMessage(draft, catalog, source, {
    requirePlacementPattern: !confirming,
  });

  return {
    ...backfill,
    meta: mergeOrderBackfillMeta(backfill.meta, extractOrderMessageMeta(source)),
  };
}

export function buildBackfillNegotiationMessage(
  language: string,
  draft: AiOrderDraft,
  meta: OrderBackfillMeta
): string | null {
  if (!meta.substitution && !meta.needsDrinkClarify) return null;

  const cartSummary = draft.items.length
    ? draft.items
        .map((line) => {
          const note = line.notes?.trim();
          return note
            ? `${line.quantity}× ${line.productName} (${note})`
            : `${line.quantity}× ${line.productName}`;
        })
        .join(", ")
    : null;

  return buildSubstitutionNegotiationMessage(language, {
    cartSummary: cartSummary || null,
    substitution: meta.substitution,
    needsDrinkClarify: meta.needsDrinkClarify,
  });
}

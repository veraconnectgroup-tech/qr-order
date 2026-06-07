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
import { formatServeSizeOption, inferServeSizeFromMessage } from "@/lib/ai/ordering/serve-size-logic";
import { isGenericCategorySegment } from "@/lib/ai/ordering/category-order-logic";
import { isGuestFinalConfirm } from "@/lib/ai/ordering/order-flow";
import {
  buildSubstitutionNegotiationMessage,
  isGenericBeerSegment,
  parseGuestSubstitution,
  substitutionReplacesFries,
  type GuestSubstitutionRequest,
} from "@/lib/denis/cognition/conversation/guest-substitution";

const ORDER_PREFIX =
  /^(daj\s+mi|daj|ho[ćc]u|hocu|mo[žz]e|želim|zelim|give\s+me|i\s+want|can\s+i\s+get|molim(\s+te)?|please|i\s+need)\s+/i;

const MULTI_ITEM_SPLIT = /\s+(?:i|und|and)\s+|,\s*/i;

const FRIES_PATTERN = /pomfrit|pones|pommes|fries|kartoffel/i;

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

function substitutionNote(sub: GuestSubstitutionRequest | null): string {
  if (!sub) return "";
  return `Zamena: ${sub.requested} umesto ${sub.insteadOf}`;
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
      notes: substitutionNote(substitution),
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
  if (draft.items.length > 0 || draft.pending) {
    return { draft, cartActions: [], meta: emptyBackfillMeta() };
  }
  const requirePlacementPattern = options?.requirePlacementPattern ?? true;
  if (requirePlacementPattern && !isOrderPlacementMessage(message)) {
    return { draft, cartActions: [], meta: emptyBackfillMeta() };
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
  if (draft.items.length > 0 || draft.pending) {
    return { draft, cartActions: [], meta: emptyBackfillMeta() };
  }

  const confirming = isGuestFinalConfirm(userMessage);
  const source = confirming
    ? (findLastOrderPlacementUserMessage(priorMessages) ??
      findLastNonConfirmUserMessage(priorMessages))
    : isOrderPlacementMessage(userMessage)
      ? userMessage
      : null;

  if (!source) {
    return { draft, cartActions: [], meta: emptyBackfillMeta() };
  }

  return backfillDraftFromOrderMessage(draft, catalog, source, {
    requirePlacementPattern: !confirming,
  });
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

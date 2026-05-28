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
import { formatServeSizeOption } from "@/lib/ai/ordering/serve-size-logic";
import { isGuestFinalConfirm } from "@/lib/ai/ordering/order-flow";

const ORDER_PREFIX =
  /^(daj\s+mi|daj|ho[ćc]u|hocu|želim|zelim|give\s+me|i\s+want|can\s+i\s+get|molim(\s+te)?|please|i\s+need)\s+/i;

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
  const tokens = segmentTokens(segment);
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

function matchPresetByNumeric(
  product: AiCatalogProduct,
  numeric: string
): string | null {
  const target = numeric.replace(",", ".").replace(/l$/i, "").trim();
  for (const preset of product.serveSizePresets) {
    const formatted = formatServeSizeOption(preset);
    const presetNumeric = formatted.replace(/l$/i, "").trim();
    if (presetNumeric === target) return formatted;
  }
  return null;
}

function inferServeSizeFromSegment(
  segment: string,
  product: AiCatalogProduct
): string | null {
  if (!product.serveSizePresets.length) return null;

  const normalized = segment.toLowerCase();

  const explicit = normalized.match(/\b(\d+[,.]?\d*)\s*l\b/);
  if (explicit) {
    const matched = matchPresetByNumeric(product, explicit[1]);
    if (matched) return matched;
  }

  if (/\b(malu|mala|small|klein|mini|0[,.]3)\b/i.test(normalized)) {
    const presets = product.serveSizePresets.map((p) => formatServeSizeOption(p));
    return presets[0] ?? null;
  }

  if (/\b(velik[oa]?|large|groß|gross|0[,.]5)\b/i.test(normalized)) {
    const presets = product.serveSizePresets.map((p) => formatServeSizeOption(p));
    return presets[presets.length - 1] ?? null;
  }

  return null;
}

function inferModifierIdsFromSegment(
  segment: string,
  product: AiCatalogProduct
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

  if (FRIES_PATTERN.test(normalized)) {
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
): AiProposedItem | null {
  const product = pickProductForSegment(segment, catalog.catalog);
  if (!product) return null;

  return {
    productId: product.id,
    quantity: 1,
    modifierIds: inferModifierIdsFromSegment(segment, product),
    serveSize: inferServeSizeFromSegment(segment, product),
    notes: "",
  };
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
): { draft: AiOrderDraft; cartActions: ValidatedCartAction[] } {
  if (draft.items.length > 0 || draft.pending) {
    return { draft, cartActions: [] };
  }
  const requirePlacementPattern = options?.requirePlacementPattern ?? true;
  if (requirePlacementPattern && !isOrderPlacementMessage(message)) {
    return { draft, cartActions: [] };
  }

  const segments = splitOrderMessageSegments(message);
  const proposed: AiProposedItem[] = [];
  const usedProductIds = new Set<string>();

  for (const segment of segments) {
    const item = segmentToProposedItem(segment, catalog);
    if (!item || usedProductIds.has(item.productId)) continue;
    proposed.push(item);
    usedProductIds.add(item.productId);
  }

  if (!proposed.length) {
    return { draft, cartActions: [] };
  }

  const processed = processProposedItems(draft, catalog, proposed, {
    userMessage: message,
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
): { draft: AiOrderDraft; cartActions: ValidatedCartAction[] } {
  if (draft.items.length > 0 || draft.pending) {
    return { draft, cartActions: [] };
  }

  const confirming = isGuestFinalConfirm(userMessage);
  const source = confirming
    ? (findLastOrderPlacementUserMessage(priorMessages) ??
      findLastNonConfirmUserMessage(priorMessages))
    : isOrderPlacementMessage(userMessage)
      ? userMessage
      : null;

  if (!source) {
    return { draft, cartActions: [] };
  }

  return backfillDraftFromOrderMessage(draft, catalog, source, {
    requirePlacementPattern: !confirming,
  });
}

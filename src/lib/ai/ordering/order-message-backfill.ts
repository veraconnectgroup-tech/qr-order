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
import { extractTurnInterpretation } from "@/lib/denis/cognition/tde/extract-turn-interpretation";
import type { TurnInterpretation } from "@/lib/denis/cognition/tde/turn-interpretation-types";
import {
  buildSubstitutionNegotiationMessage,
  drinkClarifySnippet,
  isGenericBeerSegment,
  parseGuestModifier,
  parseGuestModifiers,
  parseGuestSubstitution,
  stripGuestModifierPhrase,
  substitutionReplacesFries,
  type GuestSubstitutionRequest,
} from "@/lib/denis/cognition/conversation/guest-substitution";
import {
  parseOrderSegment,
  splitGroupOrderSegments,
  type ParsedOrderSegment,
} from "@/lib/denis/cognition/conversation/parse-group-order";
import { applyGuestCartMutations } from "@/lib/denis/cognition/conversation/apply-guest-cart-mutations";

const ORDER_PREFIX =
  /^(daj\s+mi|daj|ho[ćc]u|hocu|mo[žz]e|želim|zelim|give\s+me|i\s+want|can\s+i\s+get|molim(\s+te)?|please|i\s+need)\s+/i;

const ORDER_SUFFIX = /\s+molim(\s+te|\s+vas)?\s*$/i;

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

function segmentTokenVariants(token: string): string[] {
  const variants = new Set([token]);
  if (token.length >= 5) {
    variants.add(token.slice(0, -1));
  }
  if (token.length >= 6 && /(om|em|og|im|ih|ima|ama)$/.test(token)) {
    variants.add(token.replace(/(om|em|og|im|ih|ima|ama)$/, ""));
  }
  return [...variants].filter((value) => value.length >= 3);
}

export function isOrderPlacementMessage(message: string): boolean {
  const text = message.trim();
  if (!text || isGuestFinalConfirm(text)) return false;
  if (ORDER_PREFIX.test(text)) return true;
  if (ORDER_SUFFIX.test(text) && text.length >= 6) return true;
  if (MULTI_ITEM_SPLIT.test(text) && text.length >= 12) return true;
  return /\b(pivo|pils|pilsner|lager|radler|beer|bier|burger|kisel|kisela|cola|pizza|steak|salat|sendvič|sendvic|vino|wine|wein|kafa|coffee|espresso|limunada|sok|juice|čaj|caj|tea|tee|cevap|ćevap|pile[cć]i|dodaj|dodati)\b/i.test(
    text
  );
}

function splitCompoundDrinkAnswer(stripped: string): string[] | null {
  const hasBeer = /\b(pils|pilsner|weizen|lager|pivo|beer|bier|radler)\b/i.test(
    stripped
  );
  const hasTeaOrCoffee =
    /\b(čaj|caj|tea|tee|kafa|coffee|espresso)\b/i.test(stripped);
  if (!hasBeer || !hasTeaOrCoffee) return null;

  const split = stripped.replace(
    /\s+(?=\b(?:(?:zeleni|crni|green|black|kamili[cč]a|chamomile)\s+)?(?:čaj|caj|tea|tee|kafa|coffee|espresso)\b)/i,
    " |SPLIT| "
  );
  if (!split.includes("|SPLIT|")) return null;

  const parts = split
    .split(" |SPLIT| ")
    .map((part) => normalizeSegment(part.replace(ORDER_SUFFIX, "")))
    .filter((part) => part.length >= 2);
  return parts.length >= 2 ? parts : null;
}

export function splitOrderMessageSegments(message: string): string[] {
  return splitGroupOrderSegments(message).map((segment) =>
    segment.persona
      ? `${segment.persona} ${segment.quantity > 1 ? `${segment.quantity}× ` : ""}${segment.productText}`.trim()
      : segment.quantity > 1
        ? `${segment.quantity}× ${segment.productText}`.trim()
        : segment.productText
  );
}

function parsedSegmentsFromMessage(message: string): ParsedOrderSegment[] {
  const stripped = message
    .trim()
    .replace(ORDER_PREFIX, "")
    .replace(ORDER_SUFFIX, "")
    .trim();

  const compound = splitCompoundDrinkAnswer(stripped);
  if (compound) {
    return compound.map((part) => parseOrderSegment(part));
  }

  return splitGroupOrderSegments(message);
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
  const words = haystack.split(/\s+/);
  let score = 0;
  for (const token of tokens) {
    for (const variant of segmentTokenVariants(token)) {
      if (haystack.includes(variant)) score += 12;
      if (
        words.some(
          (word) => word.startsWith(variant) || variant.startsWith(word)
        )
      ) {
        score += 6;
      }
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

function segmentLineKey(productId: string, notes: string): string {
  return `${productId}|${notes.trim().toLowerCase()}`;
}

function segmentToProposedItem(
  segment: ParsedOrderSegment | string,
  catalog: AiCatalog,
  interpretation?: TurnInterpretation | null
): { item: AiProposedItem | null; substitution: GuestSubstitutionRequest | null } {
  const parsed: ParsedOrderSegment =
    typeof segment === "string" ? parseOrderSegment(segment) : segment;

  const rawSegment = parsed.productText;
  const modifierNotes = parseGuestModifiers(rawSegment, interpretation);
  const productSegment = stripGuestModifierPhrase(rawSegment, interpretation);
  const substitution = parseGuestSubstitution(productSegment, interpretation);
  const product = pickProductForSegment(productSegment, catalog.catalog);
  if (!product) {
    return { item: null, substitution };
  }

  const notesParts: string[] = [];
  if (parsed.persona) notesParts.push(parsed.persona);
  if (modifierNotes.length) notesParts.push(...modifierNotes);
  const notes = notesParts.join("; ");

  return {
    item: {
      productId: product.id,
      quantity: parsed.quantity,
      modifierIds: inferModifierIdsFromSegment(productSegment, product, substitution),
      serveSize: inferServeSizeFromSegment(productSegment, product),
      notes,
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
export function extractOrderMessageMeta(
  message: string,
  interpretation?: TurnInterpretation | null
): OrderBackfillMeta {
  const text = message.trim();
  if (!text || !isOrderPlacementMessage(text)) {
    return emptyBackfillMeta();
  }

  const segments = splitOrderMessageSegments(text);
  let substitution: GuestSubstitutionRequest | null = null;
  const resolvedInterpretation =
    interpretation ?? extractTurnInterpretation({ guestMessage: text, llmUsed: false });

  for (const segment of segments) {
    const parsed = parseGuestSubstitution(segment, resolvedInterpretation);
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
 * `options.interpretation` should be the LLM's own turnInterpretation for `message`
 * when available (genuine understanding) — only falls back to router/regex synthesis
 * (extractTurnInterpretation's llmUsed:false path) when none was produced this turn.
 */
export function backfillDraftFromOrderMessage(
  draft: AiOrderDraft,
  catalog: AiCatalog,
  message: string,
  options?: {
    requirePlacementPattern?: boolean;
    additive?: boolean;
    interpretation?: TurnInterpretation | null;
  }
): {
  draft: AiOrderDraft;
  cartActions: ValidatedCartAction[];
  meta: OrderBackfillMeta;
} {
  const additive = options?.additive === true;
  const interpretation =
    options?.interpretation ??
    extractTurnInterpretation({ guestMessage: message, llmUsed: false });
  const metaFromMessage = extractOrderMessageMeta(message, interpretation);
  if (draft.pending) {
    return { draft, cartActions: [], meta: metaFromMessage };
  }
  if (!additive && draft.items.length > 0) {
    return { draft, cartActions: [], meta: metaFromMessage };
  }
  const requirePlacementPattern = options?.requirePlacementPattern ?? true;
  if (requirePlacementPattern && !isOrderPlacementMessage(message)) {
    return { draft, cartActions: [], meta: metaFromMessage };
  }

  const mutation = applyGuestCartMutations(draft, catalog, message);
  draft = mutation.draft;
  if (mutation.swapped || mutation.removed) {
    return {
      draft,
      cartActions: mutation.cartActions,
      meta: metaFromMessage,
    };
  }

  const segments = parsedSegmentsFromMessage(message);
  const proposed: AiProposedItem[] = [];
  const usedLineKeys = new Set(
    draft.items.map((line) => segmentLineKey(line.productId, line.notes ?? ""))
  );
  let substitution: GuestSubstitutionRequest | null = null;
  let needsDrinkClarify = false;

  for (const segment of segments) {
    const segmentText = segment.productText;
    if (
      isGenericBeerSegment(segmentText) ||
      (GENERIC_BEER_INLINE.test(segmentText) &&
        !TYPED_DRINK_PATTERN.test(segmentText))
    ) {
      needsDrinkClarify = true;
      continue;
    }

    const parsed = segmentToProposedItem(segment, catalog, interpretation);
    if (parsed.substitution && !substitution) {
      substitution = parsed.substitution;
    }

    const item = parsed.item;
    if (!item) continue;
    const lineKey = segmentLineKey(item.productId, item.notes ?? "");
    if (usedLineKeys.has(lineKey)) continue;
    proposed.push(item);
    usedLineKeys.add(lineKey);
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

function implicitServeSizeForProduct(
  product: AiCatalogProduct | undefined
): string | null {
  if (!product) return null;
  return (
    resolveImplicitServeSizeForProduct(product) ??
    (product.menuSection === "drinks" ? "0.5L" : null)
  );
}

/** Fill missing serveSize on drink lines (policy requires volume before recap confirm). */
export function hydrateMissingDrinkServeSizes(
  draft: AiOrderDraft,
  catalog: AiCatalog
): { draft: AiOrderDraft; changed: boolean } {
  let changed = false;
  const items = draft.items.map((line) => {
    if (line.serveSize?.trim()) return line;
    const isDrink =
      line.menuSection === "drinks" ||
      TYPED_DRINK_PATTERN.test(line.productName);
    if (!isDrink) return line;
    const size = implicitServeSizeForProduct(catalog.catalog[line.productId]);
    if (!size) return line;
    changed = true;
    return { ...line, serveSize: size };
  });
  return changed ? { draft: { ...draft, items }, changed } : { draft, changed };
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
    const implicitSize = implicitServeSizeForProduct(product);
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

/**
 * `interpretation` should be the current turn's real LLM turnInterpretation
 * (from AiStructuredResponse) — only applied when reconstructing from
 * `userMessage` itself, never when reconstructing an older message from
 * `priorMessages` (that message has its own, different interpretation we
 * don't have without deeper timeline lookup — a separate follow-up).
 */
export function maybeBackfillOrderDraft(
  draft: AiOrderDraft,
  catalog: AiCatalog,
  userMessage: string,
  priorMessages: ChatHistoryMessage[],
  interpretation?: TurnInterpretation | null
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

  // Real LLM turnInterpretation is for the CURRENT guest message only — when
  // confirming, source is a past message from priorMessages, so it doesn't apply.
  const liveInterpretation = confirming ? null : (interpretation ?? null);

  if (!source) {
    return {
      draft,
      cartActions: [],
      meta: extractOrderMessageMeta(userMessage, liveInterpretation),
    };
  }

  const backfill = backfillDraftFromOrderMessage(draft, catalog, source, {
    requirePlacementPattern: !confirming,
    interpretation: liveInterpretation,
  });

  return {
    ...backfill,
    meta: mergeOrderBackfillMeta(
      backfill.meta,
      extractOrderMessageMeta(source, liveInterpretation)
    ),
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

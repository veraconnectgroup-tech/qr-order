import type { AiCatalog } from "@/lib/ai/catalog/catalog-types";
import type {
  AiOrderDraft,
  AiPendingItem,
  AiProposedItem,
  ValidatedCartAction,
} from "@/lib/ai/ordering/draft-types";
import {
  emptyOrderDraft,
  parseOrderDraft,
} from "@/lib/ai/ordering/draft-types";
import {
  validateProposedItem,
  validateProposedItems,
} from "@/lib/ai/ordering/cart-validator";
import { formatServeSize } from "@/lib/serve-size";
import { formatFlowForPrompt } from "@/lib/ai/ordering/order-flow";
import { inferServeSizeFromMessage } from "@/lib/ai/ordering/serve-size-logic";
import { normalizePendingSlotReply } from "@/lib/denis/cognition/act/fuzzy-slot-reply";

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Bare "yes"-style confirmation (sr/en/de) with no size info at all —
 * only safe to resolve when there's exactly one option, never a guess
 * between multiple sizes.
 */
const GENERIC_AFFIRMATION =
  /^(mo[žz]e|da|u redu|va[žz]i|ok(ej|ay)?|aha|jeste|tako je|yes|sure|yeah|yep|fine|ja|gerne|passt|klar)[.!]?$/i;

function isGenericAffirmation(message: string): boolean {
  return GENERIC_AFFIRMATION.test(normalizeText(message));
}

function matchServeSizeOption(message: string, options: string[]) {
  const normalized = normalizeText(message);
  for (const option of options) {
    const opt = normalizeText(option);
    const numeric = opt.replace(/l$/, "");
    if (
      normalized === opt ||
      normalized === numeric ||
      normalized.includes(opt) ||
      normalized.includes(numeric)
    ) {
      return formatServeSize(option);
    }
  }

  const fuzzy = normalizePendingSlotReply("serve_size", message, options);
  if (fuzzy !== message.trim()) {
    for (const option of options) {
      const opt = normalizeText(option);
      const fuzzyNorm = normalizeText(fuzzy);
      if (
        fuzzyNorm === opt ||
        fuzzyNorm === opt.replace(/l$/, "") ||
        opt.includes(fuzzyNorm) ||
        fuzzyNorm.includes(opt.replace(/l$/, ""))
      ) {
        return formatServeSize(option);
      }
    }
  }

  if (options.length === 1 && isGenericAffirmation(message)) {
    return formatServeSize(options[0]);
  }

  return null;
}

function matchModifierOption(message: string, pending: AiPendingItem) {
  const normalized = normalizeText(message);
  for (const missing of pending.missing) {
    if (missing.kind !== "modifierGroup") continue;
    for (const option of missing.options) {
      if (normalizeText(option.name) === normalized) {
        return option.id;
      }
    }
  }
  return null;
}

function draftItemFromAction(action: ValidatedCartAction) {
  return {
    productId: action.productId,
    productName: action.productName,
    quantity: action.quantity,
    modifierIds: action.modifiers.map((m) => m.modifierId),
    serveSize: action.serveSize,
    notes: action.notes,
    lineTotal: action.lineTotal,
    menuSection: action.menuSection,
    productTaxRate: action.productTaxRate,
  };
}

function modifierKey(ids: string[]) {
  return [...ids].sort().join(",");
}

function draftItemMatchesAction(
  item: AiOrderDraft["items"][number],
  action: ValidatedCartAction
) {
  return (
    item.productId === action.productId &&
    (item.serveSize ?? null) === (action.serveSize ?? null) &&
    item.notes === action.notes &&
    modifierKey(item.modifierIds) ===
      modifierKey(action.modifiers.map((m) => m.modifierId))
  );
}

function unitLineTotal(action: ValidatedCartAction) {
  return action.lineTotal / action.quantity;
}

function isExplicitAddMoreMessage(message: string) {
  return /jo[šs]\s+(jedn|one)|another|eine\s+weitere|one\s+more|dodaj|add\s+more|plus\s+one|\+1/i.test(
    message
  );
}

export function applyCartActionsToDraft(
  draft: AiOrderDraft,
  cartActions: ValidatedCartAction[],
  options?: { userMessage?: string }
): { draft: AiOrderDraft; appliedActions: ValidatedCartAction[] } {
  if (!cartActions.length) {
    return { draft, appliedActions: [] };
  }

  const addMore = options?.userMessage
    ? isExplicitAddMoreMessage(options.userMessage)
    : false;
  const items = [...draft.items];
  const appliedActions: ValidatedCartAction[] = [];

  for (const action of cartActions) {
    const idx = items.findIndex((item) => draftItemMatchesAction(item, action));

    if (idx >= 0) {
      const existing = items[idx];
      let nextQuantity = action.quantity;

      if (addMore) {
        nextQuantity = existing.quantity + action.quantity;
      } else if (action.quantity <= existing.quantity) {
        continue;
      }

      const unitTotal = unitLineTotal(action);
      items[idx] = {
        ...existing,
        quantity: nextQuantity,
        lineTotal: unitTotal * nextQuantity,
      };
      appliedActions.push({ ...action, quantity: nextQuantity, lineTotal: unitTotal * nextQuantity });
      continue;
    }

    items.push(draftItemFromAction(action));
    appliedActions.push(action);
  }

  if (!appliedActions.length) {
    return { draft, appliedActions: [] };
  }

  return {
    draft: {
      ...draft,
      items,
      cartRevision: draft.cartRevision + 1,
      updatedAt: new Date().toISOString(),
    },
    appliedActions,
  };
}

export function initDraftFromStorage(value: unknown): AiOrderDraft {
  return parseOrderDraft(value) ?? emptyOrderDraft();
}

export function tryResolveQuickReply(
  draft: AiOrderDraft,
  userMessage: string,
  catalog: AiCatalog
): { draft: AiOrderDraft; cartActions: ValidatedCartAction[] } | null {
  if (!draft.pending) return null;

  const pending = draft.pending;
  const product = catalog.catalog[pending.productId];
  if (!product) return null;

  let modifierIds = [...pending.modifierIds];
  let serveSize: string | null = null;
  let resolved = false;

  for (const missing of pending.missing) {
    if (missing.kind === "serveSize") {
      const matched = matchServeSizeOption(userMessage, missing.options);
      if (matched) {
        serveSize = matched;
        resolved = true;
      }
    } else if (missing.kind === "modifierGroup") {
      const modId = matchModifierOption(userMessage, pending);
      if (modId && !modifierIds.includes(modId)) {
        modifierIds = [...modifierIds, modId];
        resolved = true;
      }
    }
  }

  if (!resolved) return null;

  const proposed: AiProposedItem = {
    productId: pending.productId,
    quantity: pending.quantity,
    modifierIds,
    serveSize,
    notes: pending.notes,
  };

  const result = validateProposedItem(catalog, proposed);
  if (!result.ok) {
    return {
      draft: {
        ...draft,
        pending: result.pending,
        updatedAt: new Date().toISOString(),
      },
      cartActions: [],
    };
  }

  return {
    draft: {
      ...draft,
      items: [...draft.items, draftItemFromAction(result.action)],
      pending: null,
      cartRevision: draft.cartRevision + 1,
      updatedAt: new Date().toISOString(),
    },
    cartActions: [result.action],
  };
}

export function processProposedItems(
  draft: AiOrderDraft,
  catalog: AiCatalog,
  proposedItems: AiProposedItem[],
  options?: { userMessage?: string }
): {
  draft: AiOrderDraft;
  cartActions: ValidatedCartAction[];
  pending: AiPendingItem | null;
} {
  if (!proposedItems.length) {
    return { draft, cartActions: [], pending: draft.pending };
  }

  const userMessage = options?.userMessage?.trim();
  const enriched = userMessage
    ? proposedItems.map((item) => {
        if (item.serveSize?.trim()) return item;
        const product = catalog.catalog[item.productId];
        if (!product) return item;
        const inferred = inferServeSizeFromMessage(userMessage, product);
        return inferred ? { ...item, serveSize: inferred } : item;
      })
    : proposedItems;

  const { cartActions, pending } = validateProposedItems(catalog, enriched);
  const merged = applyCartActionsToDraft(draft, cartActions, options);

  const nextDraft: AiOrderDraft = {
    ...merged.draft,
    pending: pending ?? draft.pending,
  };

  return {
    draft: nextDraft,
    cartActions: merged.appliedActions,
    pending: nextDraft.pending,
  };
}

export function formatDraftForPrompt(draft: AiOrderDraft | null): string | null {
  if (!draft) return null;

  const lines: string[] = [];

  if (draft.pending) {
    lines.push("PENDING ORDER ITEM (needs guest choice):");
    lines.push(
      `- ${draft.pending.quantity}x ${draft.pending.productName} [${draft.pending.productId}]`
    );
    for (const missing of draft.pending.missing) {
      if (missing.kind === "serveSize") {
        lines.push(`  missing serve_size: ${missing.options.join(" | ")}`);
      } else {
        lines.push(
          `  missing ${missing.groupName}: ${missing.options.map((o) => o.name).join(" | ")}`
        );
      }
    }
  }

  if (draft.items.length) {
    lines.push("ITEMS ALREADY ADDED TO CART THIS SESSION:");
    for (const item of draft.items) {
      lines.push(
        `- ${item.quantity}x ${item.productName}${item.serveSize ? ` (${item.serveSize})` : ""}`
      );
    }
  }

  const flowBlock = formatFlowForPrompt(draft);
  if (flowBlock) {
    lines.push(flowBlock);
  }

  return lines.length ? lines.join("\n") : null;
}

export function quickRepliesFromPending(
  pending: AiPendingItem | null
): string[] {
  if (!pending) return [];
  const replies: string[] = [];
  for (const missing of pending.missing) {
    if (missing.kind === "serveSize") {
      replies.push(...missing.options);
    } else if (missing.maxSelect === 1) {
      replies.push(...missing.options.map((o) => o.name));
    }
  }
  return [...new Set(replies)].slice(0, 6);
}

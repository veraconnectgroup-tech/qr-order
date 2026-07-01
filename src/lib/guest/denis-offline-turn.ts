import type { MenuCategory } from "@/components/guest/menu-grid";
import type { MenuSection } from "@/lib/menu-section";
import { inferMenuSection } from "@/lib/menu-section";
import { heuristicSlotExtract } from "@/lib/denis/runtime/perceive/heuristic-slot-extract";
import { tryLocalGuestAnswer } from "@/lib/guest/denis-guest-recovery";
import type { SceneSituation } from "@/lib/scene/types";
import { tForAiGuestLanguage } from "@/lib/ai/guest-language";

export type DenisOfflineCartAction = {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  notes: string;
  serveSize: string | null;
  menuSection: MenuSection;
  productTaxRate: number | null;
  modifiers: Array<{
    modifierId: string;
    modifierName: string;
    price: number;
  }>;
  lineTotal: number;
};

export type DenisOfflineTurnResult = {
  message: string;
  cartActions?: DenisOfflineCartAction[];
  quickReplies?: string[];
};

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function matchMenuProduct(
  categories: MenuCategory[],
  rawName: string
): {
  productId: string;
  productName: string;
  unitPrice: number;
  menuSection: MenuSection;
  productTaxRate: number | null;
} | null {
  const needle = normalizeName(rawName);
  if (needle.length < 2) return null;

  let best: {
    productId: string;
    productName: string;
    unitPrice: number;
    menuSection: MenuSection;
    productTaxRate: number | null;
    score: number;
  } | null = null;

  for (const category of categories) {
    const section = inferMenuSection(category);
    for (const product of category.products) {
      const hay = normalizeName(product.name);
      if (!hay) continue;

      let score = 0;
      if (hay === needle) score = 100;
      else if (hay.includes(needle) || needle.includes(hay)) score = 70;
      else if (needle.split(/\s+/).some((part) => part.length > 2 && hay.includes(part))) {
        score = 45;
      }

      if (score > (best?.score ?? 0)) {
        best = {
          productId: product.id,
          productName: product.name,
          unitPrice: Number(product.price),
          menuSection: section,
          productTaxRate: product.tax_rate != null ? Number(product.tax_rate) : null,
          score,
        };
      }
    }
  }

  if (!best || best.score < 45) return null;
  return best;
}

function slotExtractToCartActions(
  categories: MenuCategory[],
  utterance: string
): DenisOfflineCartAction[] {
  const slots = heuristicSlotExtract(utterance);
  const actions: DenisOfflineCartAction[] = [];

  for (const slot of slots.items) {
    const rawName = slot.productNameRaw?.trim();
    if (!rawName) continue;

    const product = matchMenuProduct(categories, rawName);
    if (!product) continue;

    const quantity = Math.max(1, slot.quantity ?? 1);
    actions.push({
      productId: product.productId,
      productName: product.productName,
      unitPrice: product.unitPrice,
      quantity,
      notes: slot.notes ?? "",
      serveSize: slot.serveSize,
      menuSection: product.menuSection,
      productTaxRate: product.productTaxRate,
      modifiers: [],
      lineTotal: product.unitPrice * quantity,
    });
  }

  return actions;
}

function offlineOrderingTemplate(language: string, addedCount: number): string {
  if (addedCount > 0) {
    return tForAiGuestLanguage("ai.offline.orderAdded", language, {
      count: String(addedCount),
    });
  }
  return tForAiGuestLanguage("ai.chat.offline", language);
}

/**
 * Denis guest turn without network — template replies + local slot extract for ordering.
 * Proactive / LLM paths must stay disabled by callers when offline.
 */
export function runDenisOfflineTurn(input: {
  guestMessage: string;
  language: string;
  categories: MenuCategory[];
  cartItemCount: number;
  cartTotal?: number;
  currency?: string;
  situation?: SceneSituation | null;
}): DenisOfflineTurnResult {
  const localAnswer = tryLocalGuestAnswer({
    guestMessage: input.guestMessage,
    language: input.language,
    situation: input.situation,
    cartItemCount: input.cartItemCount,
    cartTotal: input.cartTotal,
    currency: input.currency,
  });

  if (localAnswer?.answeredLocally) {
    return {
      message: localAnswer.message,
      quickReplies: localAnswer.quickReplies,
    };
  }

  const cartActions = slotExtractToCartActions(input.categories, input.guestMessage);
  if (cartActions.length > 0) {
    return {
      message: offlineOrderingTemplate(input.language, cartActions.length),
      cartActions,
      quickReplies: [tForAiGuestLanguage("ai.offline.confirmOrder", input.language)],
    };
  }

  return {
    message: tForAiGuestLanguage("ai.chat.offline", input.language),
  };
}

import { getCachedMenuForLocation } from "@/lib/ai/menu-cache";
import {
  isOrderPlacementMessage,
  backfillTypedDrinkAddition,
  hydrateMissingDrinkServeSizes,
  maybeBackfillOrderDraft,
} from "@/lib/ai/ordering/order-message-backfill";
import type { AiOrderDraft } from "@/lib/denis/cognition/order";
import { initDraftFromStorage } from "@/lib/denis/cognition/order";
import type { DenisCartDraft } from "@/lib/denis/kernel/cart-projection";
import { timelineToStoredMessages } from "@/lib/denis/loop/fold-transcript";
import type { OrderFact } from "@/lib/denis/loop/types";
import { persistKernelOrderingDraft } from "@/lib/denis/runtime/act/apply-kernel-ordering";
import { aiOrderDraftToDenisCartState } from "@/lib/denis/runtime/adapters/map-legacy-draft";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import type { MenuSection } from "@/lib/menu-section";
import type { SupabaseClient } from "@supabase/supabase-js";

export function cartDraftToAiOrderDraft(draft: DenisCartDraft): AiOrderDraft {
  const base = initDraftFromStorage(null);
  return {
    ...base,
    items: draft.items.map((line) => ({
      productId: line.productId,
      productName: line.productName,
      quantity: line.quantity,
      serveSize: line.serveSize ?? null,
      modifierIds: [...line.modifierIds],
      notes: line.notes,
      lineTotal: line.lineTotal,
      menuSection: (line.menuSection ?? "drinks") as MenuSection,
      productTaxRate: line.productTaxRate ?? null,
    })),
  };
}

export function buildCommerceStatusSummary(orders: OrderFact[]): string | null {
  const open = orders.filter(
    (order) => order.status !== "delivered" && order.status !== "cancelled"
  );
  if (!open.length) return null;

  return open
    .flatMap((order) =>
      order.items.map(
        (item) =>
          `${item.quantity}× ${item.productName} (${order.status}${
            order.orderNumber != null ? ` #${order.orderNumber}` : ""
          })`
      )
    )
    .join(", ");
}

export async function maybeBackfillPlacementCart(input: {
  admin: SupabaseClient;
  timelineAiSessionId: string;
  locationId: string;
  userMessage: string;
  cartDraft: DenisCartDraft;
  timeline: DenisTimelineRow[] | undefined;
}): Promise<{
  cartDraft: DenisCartDraft;
  cartActions: Array<{ productName: string; quantity?: number }>;
}> {
  if (
    input.cartDraft.items.length === 0 &&
    !isOrderPlacementMessage(input.userMessage)
  ) {
    return { cartDraft: input.cartDraft, cartActions: [] };
  }

  try {
    const menuPayload = await getCachedMenuForLocation(input.locationId, {
      useEnglish: false,
    });
    const catalog = {
      menuText: menuPayload.menuText,
      productMap: menuPayload.productMap,
      catalog: menuPayload.catalog,
      currency: menuPayload.currency,
      cachedAt: menuPayload.cachedAt,
    };
    if (!menuPayload.catalog || Object.keys(menuPayload.catalog).length === 0) {
      return { cartDraft: input.cartDraft, cartActions: [] };
    }

    if (input.cartDraft.items.length > 0) {
      const aiDraft = cartDraftToAiOrderDraft(input.cartDraft);
      const hydrated = hydrateMissingDrinkServeSizes(aiDraft, catalog);
      if (hydrated.changed) {
        const persisted = await persistKernelOrderingDraft(
          input.admin,
          input.timelineAiSessionId,
          hydrated.draft
        );
        if (persisted.ok) {
          input = {
            ...input,
            cartDraft:
              aiOrderDraftToDenisCartState(hydrated.draft).draft ??
              input.cartDraft,
          };
        }
      }

      const drinkBackfill = backfillTypedDrinkAddition(
        cartDraftToAiOrderDraft(input.cartDraft),
        catalog,
        input.userMessage
      );
      if (drinkBackfill.cartActions.length > 0) {
        const persisted = await persistKernelOrderingDraft(
          input.admin,
          input.timelineAiSessionId,
          drinkBackfill.draft
        );
        if (persisted.ok) {
          return {
            cartDraft:
              aiOrderDraftToDenisCartState(drinkBackfill.draft).draft ??
              input.cartDraft,
            cartActions: drinkBackfill.cartActions,
          };
        }
      }
      return { cartDraft: input.cartDraft, cartActions: [] };
    }

    const priorMessages = input.timeline
      ? timelineToStoredMessages(input.timeline).map((entry) => ({
          role: entry.role,
          content: entry.content,
        }))
      : [];

    const backfill = await maybeBackfillOrderDraft(
      cartDraftToAiOrderDraft(input.cartDraft),
      catalog,
      input.userMessage,
      priorMessages,
      null,
      { skipLlmSegmentation: true }
    );

    if (backfill.draft.items.length === 0) {
      return { cartDraft: input.cartDraft, cartActions: [] };
    }

    const persisted = await persistKernelOrderingDraft(
      input.admin,
      input.timelineAiSessionId,
      backfill.draft
    );
    if (!persisted.ok) {
      return { cartDraft: input.cartDraft, cartActions: [] };
    }

    return {
      cartDraft:
        aiOrderDraftToDenisCartState(backfill.draft).draft ?? input.cartDraft,
      cartActions: backfill.cartActions,
    };
  } catch {
    return { cartDraft: input.cartDraft, cartActions: [] };
  }
}

export function dedupeHandoffQuickReplies(
  primary: string[],
  handoff?: string[]
): string[] {
  if (!handoff?.length) return primary;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const chip of [...handoff, ...primary]) {
    const trimmed = chip.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out.slice(0, 6);
}

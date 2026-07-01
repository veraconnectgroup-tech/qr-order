import type { SupabaseClient } from "@supabase/supabase-js";
import { getCachedMenuForLocation } from "@/lib/ai/menu-cache";
import { applyCartActionsToDraft } from "@/lib/ai/ordering/draft-engine";
import type { AiProposedItem, ValidatedCartAction } from "@/lib/ai/ordering/draft-types";
import { validateProposedItem } from "@/lib/ai/ordering/cart-validator";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import { foldSessionTrajectory } from "@/lib/denis/cognition/intervention/fold-session-trajectory";
import {
  detectReorderOpportunity,
  formatReorderItemsLabel,
  isReorderRequestMessage,
} from "@/lib/denis/cognition/reorder/reorder-intelligence";
import { initDraftFromStorage } from "@/lib/denis/cognition/order";
import type { DenisCartDraft } from "@/lib/denis/kernel/cart-projection";
import type { TableSessionState } from "@/lib/denis/loop/types";
import { aiOrderDraftToDenisCartState } from "@/lib/denis/runtime/adapters/map-legacy-draft";
import { persistKernelOrderingDraft } from "@/lib/denis/runtime/act/apply-kernel-ordering";
import {
  productUnavailableMessage,
  waiterAckMessage,
} from "@/lib/denis/runtime/act/guest-copy";
import { mapOrderFactsToAiGuestOrders } from "@/lib/guest/execute-guest-reorder";
import { parseReorderOrderRow } from "@/lib/supabase/parse-order-rows";
import type { AiStructuredResponse } from "@/lib/ai/types";
import { logger } from "@/lib/logger";

export type GuestReorderActResult =
  | {
      resolved: true;
      sessionId: string;
      message: string;
      cartActions: ValidatedCartAction[];
      quickReplies: string[];
      intent: AiStructuredResponse["intent"];
      cartDraft: DenisCartDraft;
      structuredPerception: AiStructuredResponse;
    }
  | { resolved: false };

export type TryApplyGuestReorderActInput = {
  admin: SupabaseClient;
  sessionId: string;
  locationId: string;
  userMessage: string;
  language: string;
  state: TableSessionState;
};

function syntheticGuestTimeline(message: string, sessionId: string) {
  return [
    {
      id: "reorder-act",
      ai_session_id: sessionId,
      seq: 1,
      event_type: "signal.message" as const,
      payload: { text: message },
      trace_id: null,
      context_hash: null,
      created_at: new Date().toISOString(),
    },
  ];
}

async function loadReorderProposedItems(
  admin: SupabaseClient,
  orderId: string,
  candidateItems: Array<{ productId: string; productName: string; quantity: number }>
): Promise<{ items: AiProposedItem[]; skipped: string[] }> {
  if (orderId === "return-guest-memory") {
    return {
      items: candidateItems
        .filter((item) => !item.productId.startsWith("memory-"))
        .map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          modifierIds: [],
          serveSize: null,
          notes: "",
        })),
      skipped: candidateItems
        .filter((item) => item.productId.startsWith("memory-"))
        .map((item) => item.productName),
    };
  }

  const { data: order } = await admin
    .from("orders")
    .select(
      "id, order_items(id, product_id, product_name, quantity, notes, menu_section, order_item_modifiers(modifier_id))"
    )
    .eq("id", orderId)
    .maybeSingle();

  if (!order) {
    return { items: [], skipped: candidateItems.map((item) => item.productName) };
  }

  const parsed = parseReorderOrderRow(order);
  const allowedIds = new Set(candidateItems.map((item) => item.productId));
  const items: AiProposedItem[] = [];
  const skipped: string[] = [];

  for (const item of parsed.order_items) {
    const productId = item.product_id?.trim();
    if (!productId || !allowedIds.has(productId)) continue;

    const candidate = candidateItems.find((row) => row.productId === productId);
    if (!candidate) continue;

    items.push({
      productId,
      quantity: candidate.quantity,
      modifierIds: item.order_item_modifiers
        .map((modifier) => modifier.modifier_id)
        .filter((id): id is string => Boolean(id?.trim())),
      serveSize: null,
      notes: item.notes ?? "",
    });
  }

  for (const candidate of candidateItems) {
    if (!items.some((item) => item.productId === candidate.productId)) {
      skipped.push(candidate.productName);
    }
  }

  return { items, skipped };
}

/**
 * P1 — deterministic ACT for guest reorder requests ("još jedno", "same again").
 */
export async function tryApplyGuestReorderAct(
  input: TryApplyGuestReorderActInput
): Promise<GuestReorderActResult> {
  const message = input.userMessage.trim();
  if (!message || !isReorderRequestMessage(message)) {
    return { resolved: false };
  }

  const now = Date.now();
  const mental = input.state.mental ?? emptyGuestMentalModel(now);
  const trajectory = foldSessionTrajectory({
    timeline: input.state.timeline,
    browse: input.state.browse,
    mental,
    orders: input.state.commerce.orders,
    cartLineCount: input.state.commerce.cart.visibleLines.length,
    timing: input.state.offer?.trace.timing,
    nowMs: now,
  });

  const opportunity = detectReorderOpportunity({
    orders: mapOrderFactsToAiGuestOrders(input.state.commerce.orders),
    mental,
    trajectory,
    memory: input.state.guest,
    party: input.state.party,
    timeline: syntheticGuestTimeline(message, input.sessionId),
    unavailableProductIds: input.state.venue.ops.unavailableProductIds,
    dismissedNudgeKeys: input.state.conversation.dismissedNudges,
    now,
  });

  if (!opportunity || opportunity.trigger !== "guest_request") {
    return { resolved: false };
  }

  const { data: sessionRow, error: sessionError } = await input.admin
    .from("ai_sessions")
    .select("order_draft")
    .eq("id", input.sessionId)
    .maybeSingle();

  if (sessionError || !sessionRow) {
    return { resolved: false };
  }

  let catalog;
  try {
    catalog = await getCachedMenuForLocation(input.locationId, {
      useEnglish: false,
    });
  } catch (error) {
    logger.warn("Guest reorder ACT catalog load failed", {
      sessionId: input.sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { resolved: false };
  }

  const { items: proposedItems, skipped: loadSkipped } =
    await loadReorderProposedItems(
      input.admin,
      opportunity.candidate.orderId,
      opportunity.candidate.items
    );

  const unavailableSkipped = opportunity.candidate.unavailableItems ?? [];
  const skippedNames = [...new Set([...loadSkipped, ...unavailableSkipped])];

  const cartActions: ValidatedCartAction[] = [];
  let draft = initDraftFromStorage(sessionRow.order_draft);

  for (const proposed of proposedItems) {
    if (input.state.venue.ops.unavailableProductIds.includes(proposed.productId)) {
      const product = catalog.catalog[proposed.productId];
      skippedNames.push(product?.name ?? proposed.productId);
      continue;
    }

    try {
      const validated = validateProposedItem(catalog, proposed);
      if (validated.ok) {
        cartActions.push(validated.action);
      } else {
        draft = {
          ...draft,
          pending: validated.pending,
        };
      }
    } catch {
      const product = catalog.catalog[proposed.productId];
      skippedNames.push(product?.name ?? proposed.productId);
    }
  }

  if (!cartActions.length && !draft.pending) {
    return { resolved: false };
  }

  if (cartActions.length) {
    const merged = applyCartActionsToDraft(draft, cartActions, {
      userMessage: message,
    });
    draft = merged.draft;
  }

  const persisted = await persistKernelOrderingDraft(
    input.admin,
    input.sessionId,
    draft
  );
  if (!persisted.ok) {
    return { resolved: false };
  }

  const cartDraft =
    aiOrderDraftToDenisCartState(draft).draft ?? {
      cartRevision: draft.cartRevision,
      items: [],
    };

  const summary = formatReorderItemsLabel(
    cartActions.map((action) => ({
      productId: action.productId,
      productName: action.productName,
      quantity: action.quantity,
    }))
  );

  let ack = summary
    ? waiterAckMessage(input.language, summary)
    : waiterAckMessage(input.language, message);

  const uniqueSkipped = [...new Set(skippedNames.filter(Boolean))];
  if (uniqueSkipped.length) {
    ack = `${ack}\n\n${productUnavailableMessage(input.language, uniqueSkipped)}`;
  }

  const structuredPerception: AiStructuredResponse = {
    intent: "order",
    message: ack,
    recommendations: [],
    proposedItems: [],
    cartActions: cartActions.map((action) => ({
      productName: action.productName,
      quantity: action.quantity,
    })),
    quickReplies: [],
    submitOrder: false,
  };

  return {
    resolved: true,
    sessionId: input.sessionId,
    message: ack,
    cartActions,
    quickReplies: [],
    intent: "order",
    cartDraft,
    structuredPerception,
  };
}

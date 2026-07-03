import type { AiCatalog } from "@/lib/ai/catalog/catalog-types";
import type { AiStructuredResponse } from "@/lib/ai/types";
import {
  formatDraftForPrompt,
  initDraftFromStorage,
  processProposedItems,
  quickRepliesFromPending,
  tryResolveQuickReply,
} from "@/lib/ai/ordering/draft-engine";
import {
  backfillDraftFromOrderMessage,
  isOrderPlacementMessage,
} from "@/lib/ai/ordering/order-message-backfill";
import {
  classMismatchGuestNote,
  guardProposedItemsAgainstMenu,
  unavailableItemsGuestNote,
} from "@/lib/ai/ordering/proposed-item-guard";
import { applyGuestCartMutations, isMidOrderCartSwapMessage } from "@/lib/denis/cognition/conversation/apply-guest-cart-mutations";
import type {
  AiOrderDraft,
  ValidatedCartAction,
} from "@/lib/ai/ordering/draft-types";
import { waiterAckMessage } from "@/lib/denis/runtime/act/guest-copy";
import { logger } from "@/lib/logger";

export type OrderingTurnResult = {
  draft: AiOrderDraft;
  cartActions: ValidatedCartAction[];
  quickReplies: string[];
  intent: AiStructuredResponse["intent"];
  skippedLlm: boolean;
  confirmationMessage?: string;
  /** Honest note when LLM-proposed items were dropped as menu hallucinations. */
  unavailableNote?: string;
};

function confirmationForActions(actions: ValidatedCartAction[]) {
  if (!actions.length) return null;
  const summary = actions
    .map((a) => {
      const mods =
        a.modifiers.length > 0
          ? ` (${a.modifiers.map((m) => m.modifierName).join(", ")})`
          : "";
      const size = a.serveSize ? ` ${a.serveSize}` : "";
      return `${a.quantity}× ${a.productName}${size}${mods}`;
    })
    .join(", ");
  return summary;
}

export function processOrderingTurn(input: {
  userMessage: string;
  allowOrdering: boolean;
  orderDraftRaw: unknown;
  catalog: AiCatalog;
  structured?: AiStructuredResponse;
  language?: string;
}): OrderingTurnResult {
  let draft = initDraftFromStorage(input.orderDraftRaw);

  if (!input.allowOrdering) {
    return {
      draft,
      cartActions: [],
      quickReplies: [],
      intent: input.structured?.intent ?? "chat",
      skippedLlm: false,
    };
  }

  const quickResolved = tryResolveQuickReply(
    draft,
    input.userMessage,
    input.catalog
  );
  if (quickResolved?.cartActions.length) {
    const summary = confirmationForActions(quickResolved.cartActions);
    return {
      draft: quickResolved.draft,
      cartActions: quickResolved.cartActions,
      quickReplies: [],
      intent: "order",
      skippedLlm: true,
      confirmationMessage: summary
        ? waiterAckMessage(input.language ?? "sr", summary)
        : undefined,
    };
  }
  if (quickResolved) {
    draft = quickResolved.draft;
  }

  if (!input.structured) {
    return {
      draft,
      cartActions: [],
      quickReplies: quickRepliesFromPending(draft.pending),
      intent: "chat",
      skippedLlm: false,
    };
  }

  let cartActions: ValidatedCartAction[] = [];
  let quickReplies = input.structured.quickReplies;

  const guarded = guardProposedItemsAgainstMenu({
    proposedItems: input.structured.proposedItems,
    catalog: input.catalog,
    userMessage: input.userMessage,
  });
  const unavailableNote =
    guarded.droppedCount > 0 && guarded.unavailableTerms.length > 0
      ? unavailableItemsGuestNote(guarded.unavailableTerms, input.language ?? "sr")
      : guarded.droppedCount > 0 && guarded.classMatchAlternatives.length > 0
        ? classMismatchGuestNote(guarded.classMatchAlternatives, input.language ?? "sr")
        : undefined;

  const hasProposed =
    guarded.items.length > 0 && !input.structured.submitOrder;
  const cartEmpty = draft.items.length === 0 && !draft.pending;

  // Always apply when cart is empty (LLM sometimes uses intent "confirm" on first item).
  // When cart has items, skip on recap/browse intents so we don't re-add the same line.
  const shouldApplyProposedItems =
    hasProposed &&
    (cartEmpty ||
      !["confirm", "status", "chat", "menu_info", "recommend"].includes(
        input.structured.intent
      ));

  if (shouldApplyProposedItems) {
    try {
      const processed = processProposedItems(
        draft,
        input.catalog,
        guarded.items,
        { userMessage: input.userMessage }
      );
      draft = processed.draft;
      cartActions = processed.cartActions;

      if (processed.pending) {
        quickReplies = [
          ...quickReplies,
          ...quickRepliesFromPending(processed.pending),
        ];
      }
    } catch (error) {
      logger.warn("AI ordering validation failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (
    cartActions.length === 0 &&
    !draft.pending &&
    (isOrderPlacementMessage(input.userMessage) ||
      isMidOrderCartSwapMessage(input.userMessage))
  ) {
    const mutation = applyGuestCartMutations(
      draft,
      input.catalog,
      input.userMessage
    );
    draft = mutation.draft;

    const backfill = backfillDraftFromOrderMessage(
      draft,
      input.catalog,
      input.userMessage,
      { additive: draft.items.length > 0 && !mutation.swapped && !mutation.removed }
    );
    draft = backfill.draft;
    cartActions = backfill.cartActions;
    if (backfill.draft.pending) {
      quickReplies = [
        ...quickReplies,
        ...quickRepliesFromPending(backfill.draft.pending),
      ];
    }
  }

  quickReplies = [...new Set(quickReplies)].slice(0, 6);

  return {
    draft,
    cartActions,
    quickReplies,
    intent: input.structured.intent,
    skippedLlm: false,
    unavailableNote,
  };
}

export { formatDraftForPrompt };

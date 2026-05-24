import type { AiCatalog } from "@/lib/ai/catalog/catalog-types";
import type { AiStructuredResponse } from "@/lib/ai/types";
import {
  formatDraftForPrompt,
  initDraftFromStorage,
  processProposedItems,
  quickRepliesFromPending,
  tryResolveQuickReply,
} from "@/lib/ai/ordering/draft-engine";
import type {
  AiOrderDraft,
  ValidatedCartAction,
} from "@/lib/ai/ordering/draft-types";
import { logger } from "@/lib/logger";

export type OrderingTurnResult = {
  draft: AiOrderDraft;
  cartActions: ValidatedCartAction[];
  quickReplies: string[];
  intent: AiStructuredResponse["intent"];
  skippedLlm: boolean;
  confirmationMessage?: string;
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
      confirmationMessage: summary ? `Added to cart: ${summary}.` : undefined,
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

  const shouldApplyProposedItems =
    input.structured.proposedItems.length > 0 &&
    !input.structured.submitOrder &&
    input.structured.intent !== "confirm" &&
    input.structured.intent !== "status" &&
    input.structured.intent !== "chat" &&
    input.structured.intent !== "menu_info" &&
    input.structured.intent !== "recommend";

  if (shouldApplyProposedItems) {
    try {
      const processed = processProposedItems(
        draft,
        input.catalog,
        input.structured.proposedItems,
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

  quickReplies = [...new Set(quickReplies)].slice(0, 6);

  return {
    draft,
    cartActions,
    quickReplies,
    intent: input.structured.intent,
    skippedLlm: false,
  };
}

export { formatDraftForPrompt };

import type { AiCatalog } from "@/lib/ai/catalog/catalog-types";
import {
  finalizeOrderFlow,
  emptyCartSubmitBlockedMessage,
  sanitizeFalseOrderClaimMessage,
} from "@/lib/ai/ordering/order-flow";
import { maybeBackfillOrderDraft } from "@/lib/ai/ordering/order-message-backfill";
import { processOrderingTurn } from "@/lib/ai/ordering/ordering-turn";
import type { AiOrderDraft } from "@/lib/ai/ordering/draft-types";
import type { AiStructuredResponse } from "@/lib/ai/types";

export type ApplyOrderComprehendInput = {
  userMessage: string;
  allowOrdering: boolean;
  orderDraft: AiOrderDraft;
  catalog: AiCatalog;
  structured: AiStructuredResponse;
  priorMessages: Array<{ role: "user" | "assistant"; content: string }>;
  language: string;
};

export type ApplyOrderComprehendResult = {
  draft: AiOrderDraft;
  cartActions: ReturnType<typeof processOrderingTurn>["cartActions"];
  quickReplies: string[];
  intent: AiStructuredResponse["intent"];
  submitOrder: boolean;
  assistantMessage: string;
};

/**
 * ADR-034-A.1 — canonical post-LLM order comprehend (cart + submit intent).
 * Gap/substitution/drink clarify → cognition/waiter only (enforceWaiterTell + DECIDE).
 */
export function applyOrderComprehend(
  input: ApplyOrderComprehendInput
): ApplyOrderComprehendResult {
  const orderingResult = processOrderingTurn({
    userMessage: input.userMessage,
    allowOrdering: input.allowOrdering,
    orderDraftRaw: input.orderDraft,
    catalog: input.catalog,
    structured: input.structured,
    language: input.language,
  });

  let workingDraft = orderingResult.draft;

  const postOrderBackfill = maybeBackfillOrderDraft(
    workingDraft,
    input.catalog,
    input.userMessage,
    input.priorMessages
  );
  workingDraft = postOrderBackfill.draft;
  const cartActionsThisTurn =
    orderingResult.cartActions.length + postOrderBackfill.cartActions.length;

  const flowResult = finalizeOrderFlow({
    userMessage: input.userMessage,
    draft: workingDraft,
    llmMessage: input.structured.message,
    llmSubmitOrder: input.structured.submitOrder,
    cartActionsThisTurn,
    language: input.language,
    guestDecliningMore: input.structured.guestDecliningMore,
    guestAbandoningOrder: input.structured.guestAbandoningOrder,
    guestDoneOrdering: input.structured.guestDoneOrdering,
    guestFinalConfirm: input.structured.guestFinalConfirm,
  });
  workingDraft = flowResult.draft;

  let assistantMessage = flowResult.message;
  let submitOrder = flowResult.submitOrder;

  if (orderingResult.unavailableNote) {
    // LLM proposed a product the guest never asked for (menu miss) — be honest
    // about the miss instead of narrating the hallucinated addition.
    assistantMessage =
      orderingResult.cartActions.length > 0
        ? `${assistantMessage} ${orderingResult.unavailableNote}`.trim()
        : orderingResult.unavailableNote;
  }

  assistantMessage = sanitizeFalseOrderClaimMessage({
    message: assistantMessage,
    draft: workingDraft,
    submitOrder,
    language: input.language,
  });

  if (
    workingDraft.items.length === 0 &&
    (submitOrder || input.structured.submitOrder)
  ) {
    submitOrder = false;
    assistantMessage = emptyCartSubmitBlockedMessage(
      input.language === "de" ||
        input.language === "en" ||
        input.language === "hr" ||
        input.language === "sr"
        ? input.language
        : "sr"
    );
  }

  return {
    draft: workingDraft,
    cartActions: [
      ...orderingResult.cartActions,
      ...postOrderBackfill.cartActions,
    ],
    quickReplies: orderingResult.quickReplies,
    intent: flowResult.intent,
    submitOrder,
    assistantMessage,
  };
}

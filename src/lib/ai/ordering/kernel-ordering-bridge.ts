import type { AiCatalog } from "@/lib/ai/catalog/catalog-types";
import {
  finalizeOrderFlow,
  emptyCartSubmitBlockedMessage,
} from "@/lib/ai/ordering/order-flow";
import { maybeBackfillOrderDraft } from "@/lib/ai/ordering/order-message-backfill";
import { processOrderingTurn } from "@/lib/ai/ordering/ordering-turn";
import type { AiOrderDraft } from "@/lib/ai/ordering/draft-types";
import type { AiStructuredResponse } from "@/lib/ai/types";

export type ApplyPostLlmOrderingInput = {
  userMessage: string;
  allowOrdering: boolean;
  orderDraft: AiOrderDraft;
  catalog: AiCatalog;
  structured: AiStructuredResponse;
  priorMessages: Array<{ role: "user" | "assistant"; content: string }>;
  language: string;
};

export type ApplyPostLlmOrderingResult = {
  draft: AiOrderDraft;
  cartActions: ReturnType<typeof processOrderingTurn>["cartActions"];
  quickReplies: string[];
  intent: AiStructuredResponse["intent"];
  submitOrder: boolean;
  assistantMessage: string;
};

/**
 * ADR-010 F8-2 — post-LLM cart + submit flow (kernel ordering path).
 * Shared by legacy adapter (when enabled) and runDenisTurn (when legacy disabled).
 */
export function applyPostLlmOrdering(
  input: ApplyPostLlmOrderingInput
): ApplyPostLlmOrderingResult {
  const orderingResult = processOrderingTurn({
    userMessage: input.userMessage,
    allowOrdering: input.allowOrdering,
    orderDraftRaw: input.orderDraft,
    catalog: input.catalog,
    structured: input.structured,
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
  });
  workingDraft = flowResult.draft;

  let assistantMessage = flowResult.message;
  let submitOrder = flowResult.submitOrder;

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

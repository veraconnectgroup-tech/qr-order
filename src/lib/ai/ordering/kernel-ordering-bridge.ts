import type { AiCatalog } from "@/lib/ai/catalog/catalog-types";
import {
  finalizeOrderFlow,
  emptyCartSubmitBlockedMessage,
  sanitizeFalseOrderClaimMessage,
} from "@/lib/ai/ordering/order-flow";
import {
  appendOrderGapClarify,
  buildBackfillNegotiationMessage,
  extractOrderMessageMeta,
  maybeBackfillOrderDraft,
} from "@/lib/ai/ordering/order-message-backfill";
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

  const orderGaps = {
    substitution:
      postOrderBackfill.meta.substitution ??
      extractOrderMessageMeta(input.userMessage).substitution,
    needsDrinkClarify:
      postOrderBackfill.meta.needsDrinkClarify ||
      extractOrderMessageMeta(input.userMessage).needsDrinkClarify,
  };

  const negotiationMessage = buildBackfillNegotiationMessage(
    input.language,
    workingDraft,
    orderGaps
  );

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
  if (orderGaps.needsDrinkClarify || orderGaps.substitution) {
    if (flowResult.intent === "confirm") {
      assistantMessage = appendOrderGapClarify(
        flowResult.message,
        input.language,
        workingDraft,
        orderGaps
      );
    } else if (negotiationMessage && cartActionsThisTurn > 0) {
      assistantMessage = negotiationMessage;
    } else {
      assistantMessage = appendOrderGapClarify(
        flowResult.message,
        input.language,
        workingDraft,
        orderGaps
      );
    }
  }
  let submitOrder = flowResult.submitOrder;

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

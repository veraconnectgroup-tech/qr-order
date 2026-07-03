import { apiSuccess } from "@/lib/api-response";
import { compileBeliefs } from "@/lib/denis/cognition/beliefs";
import { decideTurnPlan } from "@/lib/denis/cognition/tde";
import { tForAiGuestLanguage } from "@/lib/ai/guest-language";
import { planTurnWithReflex } from "@/lib/denis/kernel/reflex-plan";
import { buildDenisTurnContext } from "@/lib/denis/runtime/build-turn-context";
import { resolveTurnThinkingStepKeys } from "@/lib/denis/runtime/resolve-turn-thinking-steps";
import { parseDenisChatBody } from "@/lib/denis/surfaces/chat/parse-chat-request";
import { createAdminClient } from "@/lib/supabase/admin";

export type DenisThinkingPreviewResult = {
  steps: string[];
  planKind: string;
  planReason: string;
  requiresLlm: boolean;
};

/** Fast TDE preview — turn plan only, no LLM (guest thinking UI). */
export async function runDenisThinkingPreview(
  rawBody: unknown
): Promise<Response> {
  const parsed = parseDenisChatBody(rawBody);
  if (!parsed.ok) {
    return parsed.response;
  }

  const admin = createAdminClient();
  const ctx = await buildDenisTurnContext(admin, parsed.data);

  const beliefGraph = ctx.tableSessionState
    ? compileBeliefs({
        state: ctx.tableSessionState,
        guestMessage: parsed.data.message,
        sessionLanguage: parsed.data.language,
      })
    : { beliefs: [] };

  const reflexTurn = planTurnWithReflex({
    config: ctx.config,
    message: parsed.data.message,
    flowNodeId: ctx.flowNodeId,
    cartState: ctx.aiCartState,
    manualCartDraft: ctx.manualCartDraft,
    peerManualCartDraft: ctx.peerManualCartDraft,
    foodUpsellAsked: ctx.foodUpsellAsked,
    skipUpsell: ctx.opsEffects?.skipUpsell ?? false,
    structuredIntent: parsed.data.structuredIntent,
    handoffPaymentMethod: parsed.data.handoffPaymentMethod,
    pendingSlot: ctx.tableSessionState?.conversation.pendingSlot
      ? { kind: ctx.tableSessionState.conversation.pendingSlot }
      : null,
    hasOpenOrders:
      ctx.tableSessionState?.commerce.orders.some(
        (order) =>
          order.status !== "delivered" && order.status !== "cancelled"
      ) ?? false,
  });

  const turnPlan = decideTurnPlan({
    beliefs: beliefGraph,
    reflex: reflexTurn,
    message: parsed.data.message,
  });

  const stepKeys = resolveTurnThinkingStepKeys(
    turnPlan,
    reflexTurn,
    parsed.data.message
  );
  const language = parsed.data.language;
  const steps = stepKeys.map((key) => tForAiGuestLanguage(key, language));

  const payload: DenisThinkingPreviewResult = {
    steps,
    planKind: turnPlan.kind,
    planReason: turnPlan.reason,
    requiresLlm: turnPlan.requiresLlm,
  };

  return apiSuccess(payload);
}

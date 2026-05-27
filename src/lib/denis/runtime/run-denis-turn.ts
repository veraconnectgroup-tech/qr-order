import { apiError } from "@/lib/api-response";
import { executeChatTurn } from "@/lib/ai/execute-chat-turn";
import { planTurnWithReflex } from "@/lib/denis/kernel/reflex-plan";
import { createTurnTraceId } from "@/lib/denis/platform/timeline-types";
import { buildDenisTurnContext } from "@/lib/denis/runtime/build-turn-context";
import {
  guestSeesLegacyPath,
  kernelTimelineEnabled,
  resolveEffectiveRollout,
  shouldRunShadowDiff,
} from "@/lib/denis/config/rollout";
import { diffShadowTurn } from "@/lib/denis/runtime/shadow-diff";
import {
  guestIntentTierFromReflex,
  resolveTurnIntent,
} from "@/lib/denis/runtime/map-legacy-intent";
import { logger } from "@/lib/logger";
import { persistDenisTurnTimeline } from "@/lib/denis/runtime/persist-turn-timeline";
import {
  buildNarrationFacts,
  sanitizeNarrationOutput,
} from "@/lib/denis/runtime/narrate";
import type { DenisTurnRunInput } from "@/lib/denis/runtime/turn-types";
import { formatChatTurnApiResponse } from "@/lib/denis/surfaces/chat/format-turn-response";
import { parseDenisChatBody } from "@/lib/denis/surfaces/chat/parse-chat-request";
import { createAdminClient } from "@/lib/supabase/admin";

type LegacyChatPayload = {
  data?: {
    sessionId?: string;
    message?: string;
    intent?: string;
    recommendations?: Array<{ productName?: string; name?: string }>;
    cartActions?: Array<{ productName: string; quantity?: number }>;
    quickReplies?: string[];
    submitOrder?: boolean;
    creditsRemaining?: number;
  };
};

/**
 * Denis PPAN+ entry — perceive → plan → legacy narrate → lint → timeline (M7–M9).
 */
export async function runDenisTurn(input: DenisTurnRunInput): Promise<Response> {
  if (input.channel !== "chat") {
    return apiError("Unsupported channel.", 400);
  }

  const parsed = parseDenisChatBody(input.rawBody);
  if (!parsed.ok) {
    return parsed.response;
  }

  const admin = createAdminClient();
  const traceId = createTurnTraceId();
  const ctx = await buildDenisTurnContext(admin, parsed.data);

  const reflexTurn = planTurnWithReflex({
    config: ctx.config,
    message: parsed.data.message,
    flowNodeId: ctx.flowNodeId,
    cartState: ctx.aiCartState,
    manualCartDraft: ctx.manualCartDraft,
    foodUpsellAsked: ctx.foodUpsellAsked,
  });

  const legacyResponse = await executeChatTurn(parsed.data);
  if (legacyResponse.status !== 200) {
    return legacyResponse;
  }

  const payload = (await legacyResponse.json()) as LegacyChatPayload;
  const data = payload.data;

  if (!data?.message) {
    return legacyResponse;
  }

  const narrationFacts = buildNarrationFacts({
    config: ctx.config,
    language: parsed.data.language,
    reflexTurn,
    cartActions: data.cartActions,
    recommendations: data.recommendations,
  });

  const narration = sanitizeNarrationOutput(data.message, narrationFacts);
  const rollout = resolveEffectiveRollout(ctx.config);
  const guestMessage = guestSeesLegacyPath(rollout.mode)
    ? data.message
    : narration.message;

  if (shouldRunShadowDiff(rollout.mode)) {
    const shadowDiff = diffShadowTurn({
      legacy: {
        intent: data.intent,
        message: data.message,
        cartActionCount: data.cartActions?.length ?? 0,
        submitOrder: data.submitOrder,
      },
      denis: {
        topGoal: reflexTurn.plan.topGoal?.type ?? null,
        flowNodeId: reflexTurn.plan.transition.toNodeId,
        skillIds: reflexTurn.plan.skills.map((skill) => skill.id),
        hasConflict: reflexTurn.conflict?.hasConflict ?? false,
        lintPassed: narration.lintPassed,
        intent: reflexTurn.reflex?.intent ?? null,
      },
    });
    logger.info("Denis shadow diff", {
      traceId,
      rolloutMode: rollout.mode,
      parityScore: shadowDiff.parityScore,
      mismatches: shadowDiff.mismatches,
    });
  }

  if (data.sessionId && kernelTimelineEnabled(rollout.mode)) {
    const intent = resolveTurnIntent(
      reflexTurn.reflex?.intent,
      data.intent ?? "UNKNOWN"
    );

    await persistDenisTurnTimeline(admin, {
      aiSessionId: data.sessionId,
      locationId: parsed.data.locationId,
      traceId,
      guestMessage: parsed.data.message,
      assistantMessage: guestMessage,
      intent,
      intentTier: guestIntentTierFromReflex(reflexTurn.usedT0),
      narrationTier: narration.tier,
      reflexTurn,
    });
  }

  return formatChatTurnApiResponse(
    {
      message: guestMessage,
      recommendations: data.recommendations,
      cartActions: data.cartActions,
      quickReplies: data.quickReplies,
      intent: data.intent,
      submitOrder: data.submitOrder,
      creditsRemaining: data.creditsRemaining,
      sessionId: data.sessionId,
    },
    {
      traceId,
      channel: input.channel,
      flowNodeId: reflexTurn.plan.transition.toNodeId,
      topGoal: reflexTurn.plan.topGoal?.type ?? null,
      conflictPrompt: reflexTurn.conflict?.guestPrompt ?? null,
      narrationTier: narration.tier,
      lintPassed: narration.lintPassed,
      usedNarrationFallback: narration.usedFallback,
      rolloutMode: rollout.mode,
    }
  );
}

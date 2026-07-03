import { apiSuccess } from "@/lib/api-response";
import { getCachedMenuForLocation } from "@/lib/ai/menu-cache";
import { getBeliefValue } from "@/lib/denis/cognition/beliefs/belief-types";
import type { BeliefGraph } from "@/lib/denis/cognition/beliefs/belief-types";
import {
  planEvidence,
  type EvidencePointer,
  type TurnEvidencePack,
} from "@/lib/denis/cognition/context/plan-evidence";
import { loadTurnVkgPairingBlock } from "@/lib/denis/cognition/context/load-turn-vkg-pairings";
import {
  embedMenuQueryVector,
  ensureMenuRagEmbeddings,
} from "@/lib/denis/cognition/context/menu-rag-embeddings";
import type { MenuRagCatalog } from "@/lib/denis/cognition/context/menu-rag-types";
import { isMenuRagEnabled } from "@/lib/denis/cognition/context/retrievers/menu-rag";
import { loadVenueManifestsForLocation } from "@/lib/denis/cognition/manifest/load-venue-manifests";
import { loadTurnPlaybookBlock } from "@/lib/denis/cognition/manifest/resolve-playbook-pack";
import { narrateOfferFromBeliefs } from "@/lib/denis/cognition/offer/narrate-offer-from-beliefs";
import {
  isGuestStatusTurnReason,
  maybeProcessGuestStatusForTurn,
} from "@/lib/denis/stations/maybe-process-guest-status-for-turn";
import {
  perceiveGuestChatTurn,
} from "@/lib/denis/cognition/perceive";
import {
  buildFrustrationRecoveryEvidence,
  resolveFrustrationEmpathyMessage,
  resolveFrustrationToneDirective,
  type RecoveryAction,
} from "@/lib/denis/cognition/recovery";
import {
  resolveAdaptiveModelRoute,
  resolveRuntimeProfile,
} from "@/lib/denis/cognition/resolve-runtime-profile";
import type { DenisPerceiveMode } from "@/lib/denis/cognition/runtime-profile-types";
import { logger } from "@/lib/logger";
import {
  decideTurnPlan,
  planUtterance,
  defaultGuestChatFallback,
  tryTemplateUtterance,
  type TurnPlan,
  type TurnPlanKind,
} from "@/lib/denis/cognition/tde";
import { buildInterpretationTask } from "@/lib/denis/cognition/tde/build-interpretation-task";
import { resolveAdaptiveContextBudget } from "@/lib/denis/cognition/context/context-budget";
import {
  buildAccessibilityEvidenceBlock,
  deriveGuestAccessibility,
} from "@/lib/denis/cognition/mental-model/derive-accessibility";
import {
  buildPromoTurnContext,
  finalizePromoOfferMark,
} from "@/lib/denis/runtime/build-promo-turn-context";
import { buildCrossDeviceEvidenceBlock } from "@/lib/denis/runtime/build-cross-device-evidence";
import {
  detectConversationLoop,
  getLoopRecoveryAttempts,
  incrementLoopDetectionCount,
  incrementLoopRecoveryAttempts,
  resolveLoopRecoveryAfterAttempts,
  shouldSkipLlmForLoop,
  buildLoopRecoveryContent,
} from "@/lib/denis/monitoring";
import { timelineToStoredMessages } from "@/lib/denis/loop/fold-transcript";
import type { ReflexTurnResult } from "@/lib/denis/kernel/reflex-plan";
import type { PendingSlotActResult } from "@/lib/denis/runtime/act/resolve-pending-slot-act";
import type { GuestReorderActResult } from "@/lib/denis/runtime/act/apply-guest-reorder-act";
import { tryApplyGuestReorderAct } from "@/lib/denis/runtime/act/apply-guest-reorder-act";
import type { DenisChatBody, DenisTurnContext } from "@/lib/denis/runtime/turn-types";
import type { TdePerceiveResult } from "@/lib/denis/runtime/phases/phase-types";
import type { SupabaseClient } from "@supabase/supabase-js";

const TEMPLATE_TURN_EVIDENCE: TurnEvidencePack = {
  pointers: [],
  evidenceBlock: "",
  omitFullMenu: true,
  playbookBlock: null,
};

function resolvePerceiveMode(
  turnPlan: TurnPlan,
  interpretationTask?: ReturnType<typeof buildInterpretationTask>
): DenisPerceiveMode {
  if (interpretationTask) {
    return interpretationTask.evidenceBudget.perceiveMode;
  }
  if (
    turnPlan.kind === "relational_perceive" ||
    turnPlan.kind === "narrate_paraphrase"
  ) {
    return "social";
  }
  return "commerce";
}

function mapTemplateIntent(
  turnPlan: TurnPlan
): "chat" | "clarify" | "confirm" | "menu_info" {
  if (turnPlan.kind === "slot_extract") return "clarify";
  if (turnPlan.templateKey === "cart.conflict") return "confirm";
  return "chat";
}

export function buildGuestReorderActPerceiveResult(
  act: Extract<GuestReorderActResult, { resolved: true }>,
  suppressUpsell: boolean,
  tier: string
): TdePerceiveResult {
  const turnPlan: TurnPlan = {
    kind: "reflex_only",
    requiresLlm: false,
    suppressUpsell,
    reason: "act.reorder.guest_request",
  };

  return {
    response: apiSuccess({
      message: act.message,
      recommendations: [],
      cartActions: act.cartActions,
      quickReplies: act.quickReplies,
      intent: act.structuredPerception.intent,
      submitOrder: act.structuredPerception.submitOrder ?? false,
      sessionId: act.sessionId,
      structuredPerception: act.structuredPerception,
    }),
    turnPlan,
    llmUsed: false,
    planKind: turnPlan.kind,
    tier,
    evidencePointers: ["act.reorder"],
    pendingSlotActResolved: true,
    cartDraftFromAct: act.cartDraft,
  };
}

export function buildPendingSlotActPerceiveResult(
  act: Extract<PendingSlotActResult, { resolved: true }>,
  suppressUpsell: boolean,
  tier: string
): TdePerceiveResult {
  const turnPlan: TurnPlan = {
    kind: "transactional_perceive",
    requiresLlm: false,
    suppressUpsell,
    reason: "act.pending_slot.resolved",
  };

  return {
    response: apiSuccess({
      message: act.message,
      recommendations: [],
      cartActions: act.cartActions,
      quickReplies: act.quickReplies,
      intent: act.structuredPerception.intent,
      submitOrder: act.structuredPerception.submitOrder ?? false,
      sessionId: act.sessionId,
      structuredPerception: act.structuredPerception,
    }),
    turnPlan,
    llmUsed: false,
    planKind: turnPlan.kind,
    tier,
    evidencePointers: ["commerce.*"],
    pendingSlotActResolved: true,
    cartDraftFromAct: act.cartDraft,
  };
}

/** MR-3 — decideTurnPlan → perceive (LLM only when plan.requiresLlm). G4 single caller. */
export async function runTdePerceive(input: {
  admin: SupabaseClient;
  body: DenisChatBody;
  ctx: DenisTurnContext;
  reflexTurn: ReflexTurnResult;
  beliefs: BeliefGraph;
  timelineEnabled: boolean;
  orgId: string;
  frustrationRecovery?: RecoveryAction[];
  forceT0Only?: boolean;
}): Promise<TdePerceiveResult> {
  const tdeBeliefs = input.beliefs as Parameters<
    typeof decideTurnPlan
  >[0]["beliefs"];

  let turnPlan = decideTurnPlan({
    beliefs: tdeBeliefs,
    reflex: input.reflexTurn,
    message: input.body.message,
    conversationGraph: input.ctx.tableSessionState?.conversation.model.graph,
  });

  if (input.forceT0Only && turnPlan.requiresLlm) {
    turnPlan = {
      ...turnPlan,
      reason: "health.t0_fallback",
    };
  }

  const aiSessionId =
    input.body.sessionId ??
    input.ctx.draftAiSessionId ??
    input.ctx.aiSessionId ??
    null;

  if (
    turnPlan.reason === "commerce.reorder.guest_request" &&
    aiSessionId &&
    input.ctx.tableSessionState
  ) {
    const reorderAct = await tryApplyGuestReorderAct({
      admin: input.admin,
      sessionId: aiSessionId,
      locationId: input.body.locationId,
      userMessage: input.body.message,
      language: input.body.language,
      state: input.ctx.tableSessionState,
    });

    if (reorderAct.resolved) {
      const { profile } = resolveRuntimeProfile(input.ctx.config, null, null);
      return buildGuestReorderActPerceiveResult(
        reorderAct,
        turnPlan.suppressUpsell,
        profile.tier
      );
    }
  }

  let interpretationTask = buildInterpretationTask(
    input.reflexTurn.plan.topGoal,
    tdeBeliefs,
    {
      guestMessage: input.body.message,
      conversationGraph: input.ctx.tableSessionState?.conversation.model.graph,
    }
  );

  const frustrationRecoveryBlock = buildFrustrationRecoveryEvidence(
    input.frustrationRecovery ?? []
  );
  const toneDirective = resolveFrustrationToneDirective(
    input.frustrationRecovery ?? []
  );
  if (interpretationTask && toneDirective) {
    interpretationTask = {
      ...interpretationTask,
      directiveBlock: `${interpretationTask.directiveBlock}\n${toneDirective}`,
    };
  } else if (!interpretationTask && toneDirective && turnPlan.requiresLlm) {
    const goalType = input.reflexTurn.plan.topGoal?.type ?? "GUEST_SEATED";
    interpretationTask = {
      schema: "relational_social",
      evidenceBudget: {
        perceiveMode: "social",
        pointers: ["situation.pack"],
        includeCatalogRag: false,
        includePlaybook: false,
        omitFullMenuWhenNoRag: true,
        contextTokenBudget: 1500,
        turnComplexity: "moderate",
      },
      planKind: turnPlan.kind,
      goalType,
      reason: "frustration.recovery.tone",
      directiveBlock: toneDirective,
    };
  }

  const empathyPrefix = resolveFrustrationEmpathyMessage(
    input.frustrationRecovery ?? []
  );

  const utterancePlan = planUtterance({
    beliefs: tdeBeliefs,
    turnPlan,
    topGoal: input.reflexTurn.plan.topGoal,
  });

  let templateMessage = !turnPlan.requiresLlm
    ? tryTemplateUtterance(utterancePlan)
    : null;

  if (turnPlan.reason === "offer.anchored_recommend") {
    templateMessage =
      narrateOfferFromBeliefs(tdeBeliefs, input.body.language) ?? templateMessage;
  }

  let guestStatusSection: string | null = null;

  if (
    isGuestStatusTurnReason(turnPlan.reason) &&
    input.ctx.tableSessionState?.commerce.orders.length
  ) {
    try {
      const state = input.ctx.tableSessionState;
      const statusInquiry = await maybeProcessGuestStatusForTurn(input.admin, {
        turnPlanReason: turnPlan.reason,
        locationId: input.body.locationId,
        tableId: input.body.tableId,
        tableName: state.table.name || null,
        orders: state.commerce.orders,
        venueOps: input.ctx.venueOps,
        config: input.ctx.config,
      });
      guestStatusSection = statusInquiry?.section ?? null;
    } catch (statusError) {
      logger.warn("guest status inquiry failed", {
        locationId: input.body.locationId,
        error:
          statusError instanceof Error
            ? statusError.message
            : String(statusError),
      });
    }
  }

  if (empathyPrefix && templateMessage) {
    templateMessage = `${empathyPrefix}\n\n${templateMessage}`;
  } else if (empathyPrefix && !turnPlan.requiresLlm) {
    templateMessage = empathyPrefix;
  }

  const transcriptForTurn = input.ctx.tableSessionState?.timeline
    ? timelineToStoredMessages(input.ctx.tableSessionState.timeline).map(
        (entry) => ({
          role: entry.role,
          content: entry.content,
        })
      )
    : undefined;

  const perceiveMode = resolvePerceiveMode(turnPlan, interpretationTask);
  const pressure = getBeliefValue<string>(input.beliefs, "commerce.pressure");
  const awaiting = getBeliefValue<string | null>(
    input.beliefs,
    "conversation.awaiting"
  );
  const cartLineCount =
    input.ctx.aiCartState.draft?.items?.length ??
    input.ctx.tableSessionState?.commerce.cart.visibleLines.length ??
    0;
  const conversationMode = getBeliefValue<
    "banter" | "ordering" | "settling"
  >(input.beliefs, "conversation.mode");
  const leadershipContext = {
    inOrderingFlow:
      pressure === "open" ||
      pressure === "confirm" ||
      turnPlan.kind === "transactional_perceive" ||
      cartLineCount > 0,
    awaitingAnswer: awaiting != null && awaiting !== "",
    transactionalTurn: turnPlan.kind === "transactional_perceive",
    hasPriorMessages: (transcriptForTurn?.length ?? 0) > 0,
    conversationMode,
    commercePressure:
      pressure === "open" || pressure === "confirm"
        ? (pressure as "open" | "confirm")
        : ("none" as const),
  };

  if (!turnPlan.requiresLlm) {
    const { profile } = resolveRuntimeProfile(input.ctx.config, null, null);
    const response = await perceiveGuestChatTurn(input.body, {
      turnPlan,
      interpretationTask,
      evidence: TEMPLATE_TURN_EVIDENCE,
      perceiveMode,
      leadershipContext,
      skipLlm: true,
      templateMessage:
        templateMessage ??
        (turnPlan.kind === "reflex_only"
          ? ""
          : defaultGuestChatFallback(input.body.language)),
      templateIntent: mapTemplateIntent(turnPlan),
    });

    return {
      response,
      turnPlan,
      llmUsed: false,
      planKind: turnPlan.kind,
      tier: profile.tier,
      evidencePointers: [],
      frustrationRecovery: input.frustrationRecovery,
    };
  }

  const loopTimeline = input.ctx.tableSessionState?.timeline ?? [];
  const loopDetection = detectConversationLoop(loopTimeline, 6);
  const loopSessionId =
    input.ctx.draftAiSessionId ??
    input.body.sessionId ??
    input.ctx.aiSessionId ??
    "";

  if (loopDetection.detected) {
    void incrementLoopDetectionCount(input.ctx.locationId);

    const recoveryAttempts = await getLoopRecoveryAttempts(loopSessionId);

    if (shouldSkipLlmForLoop(loopDetection, recoveryAttempts)) {
      await incrementLoopRecoveryAttempts(loopSessionId);

      const recovery = resolveLoopRecoveryAfterAttempts(
        loopDetection,
        recoveryAttempts
      );
      const loopContent = buildLoopRecoveryContent({
        recovery,
        language: input.body.language,
      });
      const loopHint =
        loopContent.contextInjection ??
        loopContent.message ??
        "Guest conversation is looping — rephrase and offer concrete menu choices.";

      if (interpretationTask) {
        interpretationTask = {
          ...interpretationTask,
          directiveBlock: `${interpretationTask.directiveBlock}\n${loopHint}`,
        };
      } else {
        interpretationTask = {
          schema: "relational_social",
          evidenceBudget: {
            perceiveMode: "social",
            pointers: ["situation.pack"],
            includeCatalogRag: false,
            includePlaybook: false,
            omitFullMenuWhenNoRag: true,
            contextTokenBudget: 1500,
            turnComplexity: "moderate",
          },
          planKind: turnPlan.kind,
          goalType: input.reflexTurn.plan.topGoal?.type ?? "GUEST_SEATED",
          reason: `loop.${loopDetection.type ?? "unknown"}`,
          directiveBlock: loopHint,
        };
      }
    } else if (
      loopDetection.recovery.action === "rephrase" &&
      loopDetection.recovery.hint
    ) {
      const hintBlock = loopDetection.recovery.guestAnswer
        ? `${loopDetection.recovery.hint}\nRaniji gostov odgovor: ${loopDetection.recovery.guestAnswer}`
        : loopDetection.recovery.hint;
      if (interpretationTask) {
        interpretationTask = {
          ...interpretationTask,
          directiveBlock: `${interpretationTask.directiveBlock}\n${hintBlock}`,
        };
      } else {
        interpretationTask = {
          schema: "relational_social",
          evidenceBudget: {
            perceiveMode: "social",
            pointers: ["situation.pack"],
            includeCatalogRag: false,
            includePlaybook: false,
            omitFullMenuWhenNoRag: true,
            contextTokenBudget: 1500,
            turnComplexity: "moderate",
          },
          planKind: turnPlan.kind,
          goalType: input.reflexTurn.plan.topGoal?.type ?? "GUEST_SEATED",
          reason: "loop.rephrase.mild",
          directiveBlock: hintBlock,
        };
      }
    }
  }

  const manifestBundle = await loadVenueManifestsForLocation(input.body.locationId);
  const { profile, effective } = resolveRuntimeProfile(
    input.ctx.config,
    manifestBundle.locationRaw,
    manifestBundle.orgRaw
  );

  if (interpretationTask) {
    const adaptiveBudget = resolveAdaptiveContextBudget({
      guestMessage: input.body.message,
      maxContextTokens: profile.maxContextTokens,
      minContextTokens: profile.minContextTokens,
      adaptiveEnabled: profile.adaptiveContext,
      beliefs: tdeBeliefs,
    });
    interpretationTask = {
      ...interpretationTask,
      evidenceBudget: {
        ...interpretationTask.evidenceBudget,
        contextTokenBudget: adaptiveBudget.tokenBudget,
        turnComplexity: adaptiveBudget.complexity,
      },
    };
  }

  let catalog: MenuRagCatalog | null = null;
  try {
    const menuPayload = await getCachedMenuForLocation(input.body.locationId);
    catalog = menuPayload.catalog ?? null;
  } catch {
    catalog = null;
  }

  let menuRagEmbeddings = null;
  let menuRagQueryVector = null;
  if (
    catalog &&
    Object.keys(catalog).length > 0 &&
    isMenuRagEnabled({
      catalogRagLevel: effective.capabilities.catalogRag,
      menuRagEnabled: profile.menuRagEnabled,
    })
  ) {
    try {
      const ragBundle = await ensureMenuRagEmbeddings(
        input.body.locationId,
        catalog
      );
      menuRagEmbeddings = ragBundle.index;
      menuRagQueryVector = await embedMenuQueryVector(
        input.body.message,
        ragBundle.space
      );
    } catch {
      menuRagEmbeddings = null;
      menuRagQueryVector = null;
    }
  }

  const [vkgPairingBlock, playbookBlock] = await Promise.all([
    loadTurnVkgPairingBlock({
      locationId: input.body.locationId,
      config: input.ctx.config,
      state: input.ctx.tableSessionState,
      reflexTurn: input.reflexTurn,
      guestAllergens: input.body.preferences?.allergies,
      guestMessage: input.body.message,
      turnPlan,
      unavailableProductIds: input.ctx.venueOps?.unavailableProductIds ?? [],
      popularProductIds:
        input.ctx.rhythmContext?.topProducts.flatMap((row) =>
          row.productId ? [row.productId] : []
        ) ?? [],
    }),
    loadTurnPlaybookBlock({
      orgId: input.orgId,
      locationId: input.body.locationId,
      playbookPackId: effective.playbookPackId,
      customPlaybookPack: effective.customPlaybookPack,
    }).catch(() => null),
  ]);

  const promoTurnContext = await buildPromoTurnContext(input.admin, {
    ctx: input.ctx,
    guestMessage: input.body.message,
    aiSessionId: input.body.sessionId,
  });

  const crossDeviceBlock = buildCrossDeviceEvidenceBlock({
    party: input.ctx.party,
    currentDevice: input.body.deviceFingerprint ?? null,
    timeline: input.ctx.tableSessionState?.timeline ?? [],
  });

  const accessibilityBlock = buildAccessibilityEvidenceBlock(
    deriveGuestAccessibility({
      timeline: input.ctx.tableSessionState?.timeline ?? [],
      guestMessage: input.body.message,
      clientSignals: input.body.accessibilitySignals ?? null,
      guestMemory: input.ctx.guestMemory,
      previous: input.ctx.tableSessionState?.mental.accessibility ?? null,
      inputSurface: input.body.inputSurface,
    })
  );

  const evidence = planEvidence({
    turnPlan,
    interpretationTask,
    beliefs: input.beliefs,
    capabilities: effective.capabilities,
    profile,
    guestMessage: input.body.message,
    state: input.ctx.tableSessionState,
    sessionPhase: input.ctx.foldMeta?.phase ?? null,
    flowNodeId: input.ctx.flowNodeId,
    transcript: transcriptForTurn,
    guestMemory: input.ctx.guestMemory,
    venueOps: input.ctx.venueOps,
    opsEffects: input.ctx.opsEffects,
    rhythm: input.ctx.rhythmContext,
    revenueInsight: input.ctx.revenueInsight,
    catalog,
    menuRagEmbeddings,
    menuRagQueryVector,
    playbookBlock,
    vkgPairingBlock,
    frustrationRecoveryBlock,
    promoBlock: promoTurnContext.promoBlock,
    crossDeviceBlock,
    accessibilityBlock,
    guestStatusSection,
  });

  const modelRoute = resolveAdaptiveModelRoute({
    message: input.body.message,
    turnPlan,
    profile,
    perceiveMode,
    beliefs: tdeBeliefs,
  });

  const response = await perceiveGuestChatTurn(input.body, {
    turnPlan,
    interpretationTask,
    evidence,
    perceiveMode,
    leadershipContext,
    model: modelRoute.model ?? undefined,
    modelTier: modelRoute.modelTier,
    extendedThinking: modelRoute.extendedThinking,
    complexityScore: modelRoute.complexity.score,
    pipeline: {
      allergyLabels: input.body.preferences?.allergies,
      unavailableProductIds: input.ctx.venueOps?.unavailableProductIds ?? [],
      reflexIntent:
        input.reflexTurn.pipelineHints?.reflexIntent ??
        input.reflexTurn.pipelineHints?.handoffIntent,
    },
  });

  logger.info("Denis adaptive model route", {
    modelTier: modelRoute.modelTier,
    model: modelRoute.model,
    complexityScore: modelRoute.complexity.score,
  });

  void finalizePromoOfferMark(promoTurnContext);

  return {
    response,
    turnPlan,
    llmUsed: true,
    planKind: turnPlan.kind,
    tier: profile.tier,
    modelTier: modelRoute.modelTier,
    model: modelRoute.model,
    complexityScore: modelRoute.complexity.score,
    evidencePointers: evidence.pointers,
    frustrationRecovery: input.frustrationRecovery,
  };
}

export type { TurnPlanKind, EvidencePointer };

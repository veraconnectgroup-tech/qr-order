import { apiError, apiSuccess } from "@/lib/api-response";
import { getCachedMenuForLocation } from "@/lib/ai/menu-cache";
import { applyStructuredPerceptionOrdering } from "@/lib/denis/runtime/perceive/apply-structured-perception-ordering";
import {
  perceiveGuestChatTurn,
  type DenisPerceiveTurnOpts,
} from "@/lib/denis/cognition/perceive";
import type { BeliefGraph } from "@/lib/denis/cognition/beliefs/belief-types";
import { getBeliefValue } from "@/lib/denis/cognition/beliefs/belief-types";
import {
  planEvidence,
  type TurnEvidencePack,
} from "@/lib/denis/cognition/context/plan-evidence";
import { loadTurnVkgPairingBlock } from "@/lib/denis/cognition/context/load-turn-vkg-pairings";
import { loadVenueManifestsForLocation } from "@/lib/denis/cognition/manifest/load-venue-manifests";
import { loadTurnPlaybookBlock } from "@/lib/denis/cognition/manifest/resolve-playbook-pack";
import type { MenuRagCatalog } from "@/lib/denis/cognition/context/menu-rag-types";
import {
  embedMenuQueryVector,
  ensureMenuRagEmbeddings,
} from "@/lib/denis/cognition/context/menu-rag-embeddings";
import { isMenuRagEnabled } from "@/lib/denis/cognition/context/retrievers/menu-rag";
import {
  resolvePerceiveModel,
  resolveRuntimeProfile,
} from "@/lib/denis/cognition/resolve-runtime-profile";
import type { DenisPerceiveMode } from "@/lib/denis/cognition/runtime-profile-types";
import {
  decideTurnPlan,
  planUtterance,
  defaultGuestChatFallback,
  tryTemplateUtterance,
  type TurnPlan,
  type TurnPlanKind,
} from "@/lib/denis/cognition/tde";
import { buildInterpretationTask } from "@/lib/denis/cognition/tde/build-interpretation-task";
import {
  assertSufficientCredits,
  finalizeTurnMetering,
  maybeEnqueueLowBalanceAlert,
  refreshOrgAiOpsProjection,
  resolveAiTurnOrg,
} from "@/lib/denis/commercial";
import { planTurnWithReflex } from "@/lib/denis/kernel/reflex-plan";
import { appendDenisTimelineEvent } from "@/lib/denis/platform/append-timeline-event";
import { createTurnTraceId } from "@/lib/denis/platform/timeline-types";
import { appendMindFoldCompleted } from "@/lib/denis/loop/append-fold-completed";
import { timelineToStoredMessages } from "@/lib/denis/loop/fold-transcript";
import {
  appendMindBeliefsCompiled,
  compileBeliefs,
  CORE_BELIEF_KEYS,
} from "@/lib/denis/cognition/beliefs";
import {
  tryResolvePendingSlotAct,
  sessionDraftHasPendingSlot,
  type PendingSlotActResult,
} from "@/lib/denis/runtime/act/resolve-pending-slot-act";
import {
  appendMindTurnProfile,
  buildTurnProfile,
} from "@/lib/denis/cognition/quality/turn-profile";
import { buildDenisTurnContext } from "@/lib/denis/runtime/build-turn-context";
import { resolveCanonicalChatAiSessionId } from "@/lib/denis/venue/party";
import {
  kernelTimelineEnabled,
  resolveEffectiveRollout,
  resolveGuestLegacyPath,
  shouldRunShadowDiff,
} from "@/lib/denis/config/rollout";
import { diffShadowTurn } from "@/lib/denis/runtime/shadow-diff";
import {
  guestIntentTierFromReflex,
  resolveTurnIntent,
} from "@/lib/denis/runtime/map-legacy-intent";
import { logger } from "@/lib/logger";
import {
  guestFollowUpFromMessage,
  persistGuestFollowUpRequest,
} from "@/lib/denis/runtime/persist-guest-continuity";
import { persistDenisTurnTimeline } from "@/lib/denis/runtime/persist-turn-timeline";
import {
  buildNarrationFacts,
  resolveTurnQuickReplies,
  sanitizeNarrationOutput,
} from "@/lib/denis/runtime/narrate";
import { resolveTurnNarrationMessage } from "@/lib/denis/runtime/narrate/resolve-turn-narration";
import {
  extractOrderSlots,
  shouldRunSlotExtract,
} from "@/lib/denis/runtime/perceive";
import { executeActPhase, isActSubmitLive, resolveActSubmitOutcome } from "@/lib/denis/runtime/act";
import { executeTurnOrderSubmit } from "@/lib/denis/runtime/act/execute-turn-order-submit";
import {
  orderSubmitNotAttemptedMessage,
  orderSubmitSuccessMessage,
} from "@/lib/denis/runtime/act/commit-outcome-messages";
import { executeDenisPaymentHandoff } from "@/lib/denis/acl/execute-denis-payment-handoff";
import { executeDenisWaiterHandoff } from "@/lib/denis/acl/execute-denis-waiter-handoff";
import { persistAiSessionAfterOrderSubmit } from "@/lib/denis/runtime/act/persist-ai-session-after-order-submit";
import {
  handoffActEnabled,
  resolveActHandoffOutcome,
} from "@/lib/denis/runtime/act/resolve-act-handoff-outcome";
import { resolveActOrderChangeOutcome } from "@/lib/denis/runtime/act/resolve-act-order-change-outcome";
import {
  elapsedMs,
  emptyTurnTimings,
  logDenisTurnObservability,
} from "@/lib/denis/runtime/turn-observability";
import type { AiStructuredResponse, AiRecommendation } from "@/lib/ai/types";
import type { ReflexTurnResult } from "@/lib/denis/kernel/reflex-plan";
import type {
  DenisChatBody,
  DenisTurnContext,
  DenisTurnRunInput,
} from "@/lib/denis/runtime/turn-types";
import { formatChatTurnApiResponse } from "@/lib/denis/surfaces/chat/format-turn-response";
import { parseDenisChatBody } from "@/lib/denis/surfaces/chat/parse-chat-request";
import { formatVoiceTurnApiResponse } from "@/lib/denis/surfaces/voice/format-voice-response";
import { parseDenisVoiceBody } from "@/lib/denis/surfaces/voice/parse-voice-turn";
import type {
  PerceptionChannel,
  TurnEnvelope,
} from "@/lib/denis/platform/timeline-types";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolveActiveTableSessionId,
  resolveGuestTableSessionLookupToken,
} from "@/lib/denis/venue/party";
import {
  isOrderPlacementMessage,
  backfillTypedDrinkAddition,
  hydrateMissingDrinkServeSizes,
  maybeBackfillOrderDraft,
} from "@/lib/ai/ordering/order-message-backfill";
import { persistKernelOrderingDraft } from "@/lib/denis/runtime/act/apply-kernel-ordering";
import { aiOrderDraftToDenisCartState } from "@/lib/denis/runtime/adapters/map-legacy-draft";
import type { SupabaseClient } from "@supabase/supabase-js";
import { scheduleGuestSceneRefresh } from "@/lib/scene/enqueue-scene-refresh";
import { mapTurnToSceneOverrides } from "@/lib/scene/map-turn-to-scene-overrides";
import {
  initDraftFromStorage,
  sanitizeGuestOrderHonesty,
  type AiOrderDraft,
} from "@/lib/denis/cognition/order";
import {
  assessWaiterObligation,
  mergeTableSessionObligation,
  enforceWaiterTell,
  lastOrderPlacementFromTranscript,
} from "@/lib/denis/cognition/waiter";
import type { PendingSlotKind } from "@/lib/denis/platform/pending-slot-types";
import type { DenisCartDraft } from "@/lib/denis/kernel/cart-projection";
import type { MenuSection } from "@/lib/menu-section";
import type { OrderFact } from "@/lib/denis/loop/types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { ActHandoffOutcome } from "@/lib/denis/runtime/act/resolve-act-handoff-outcome";
import type { ActPhaseResult } from "@/lib/denis/runtime/act/act-types";

async function maybeBackfillPlacementCart(input: {
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

    const backfill = maybeBackfillOrderDraft(
      cartDraftToAiOrderDraft(input.cartDraft),
      catalog,
      input.userMessage,
      priorMessages
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

function cartDraftToAiOrderDraft(draft: DenisCartDraft): AiOrderDraft {
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

function buildCommerceStatusSummary(orders: OrderFact[]): string | null {
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

/** Direct ACL when act phase did not commit handoff (ADR-032 belt-and-suspenders). */
async function runHandoffAclFallback(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    config: ConciergeConfig;
    reflexTurn: ReflexTurnResult;
    parsed: DenisChatBody;
    language: string;
    actHandoffOutcome: ActHandoffOutcome;
  }
): Promise<ActHandoffOutcome> {
  if (input.actHandoffOutcome.attempted || !input.reflexTurn.handoffCommand) {
    return input.actHandoffOutcome;
  }
  if (!handoffActEnabled(input.config)) {
    return input.actHandoffOutcome;
  }

  const cmd = input.reflexTurn.handoffCommand;
  const sessionToken =
    input.parsed.tableSessionToken ?? input.parsed.sessionToken;

  if (cmd.type === "WAITER.REQUEST") {
    if (!input.parsed.tableId || !input.parsed.locationId) {
      return input.actHandoffOutcome;
    }
    const result = await executeDenisWaiterHandoff(admin, {
      tableId: input.parsed.tableId,
      locationId: input.parsed.locationId,
      tableToken: input.parsed.sessionToken,
      sessionToken,
    });
    const actPhase: ActPhaseResult = {
      enabled: true,
      dryRun: false,
      results: [
        {
          skillId: "handoff.waiter",
          riskClass: "R3",
          dryRun: false,
          ok: result.ok,
          error: result.ok ? undefined : result.error,
        },
      ],
    };
    return resolveActHandoffOutcome(actPhase, input.language);
  }

  if (!sessionToken || !input.parsed.tableId || !input.parsed.locationId) {
    return input.actHandoffOutcome;
  }

  const paymentMethod =
    cmd.type === "BILL.SET_METHOD"
      ? cmd.method
      : input.reflexTurn.handoffPaymentMethod ?? null;

  const result = await executeDenisPaymentHandoff(admin, {
    tableId: input.parsed.tableId,
    locationId: input.parsed.locationId,
    sessionToken,
    paymentMethod,
  });

  const actPhase: ActPhaseResult = {
    enabled: true,
    dryRun: false,
    results: [
      {
        skillId: "handoff.payment",
        riskClass: "R1",
        dryRun: false,
        ok: result.ok,
        error: result.ok ? undefined : result.error,
        detail: result.ok
          ? result.needsMethod
            ? { needsMethod: true }
            : {
                needsMethod: false,
                paymentMethod: result.paymentMethod,
                openPaymentSheet: result.openPaymentSheet ?? false,
              }
          : undefined,
      },
    ],
  };
  return resolveActHandoffOutcome(actPhase, input.language);
}

function dedupeHandoffQuickReplies(
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

function isSupportedTurnChannel(
  channel: DenisTurnRunInput["channel"]
): channel is "chat" | "voice" {
  return channel === "chat" || channel === "voice";
}

type TdePerceiveResult = {
  response: Response;
  turnPlan: TurnPlan;
  llmUsed: boolean;
  planKind: TurnPlanKind;
  tier: string;
  evidencePointers: string[];
  pendingSlotActResolved?: boolean;
  cartDraftFromAct?: DenisTurnContext["aiCartState"]["draft"];
};

function buildPendingSlotActPerceiveResult(
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
    evidencePointers: ["act.pending_slot"],
    pendingSlotActResolved: true,
    cartDraftFromAct: act.cartDraft,
  };
}

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

const TEMPLATE_TURN_EVIDENCE: TurnEvidencePack = {
  pointers: [],
  evidenceBlock: "",
  omitFullMenu: true,
  playbookBlock: null,
};

function mapTemplateIntent(
  turnPlan: TurnPlan
): "chat" | "clarify" | "confirm" | "menu_info" {
  if (turnPlan.kind === "slot_extract") return "clarify";
  if (turnPlan.templateKey === "cart.conflict") return "confirm";
  return "chat";
}

/** MR-3 — decideTurnPlan → perceive (LLM only when plan.requiresLlm). G4 single caller. */
async function runTdePerceive(input: {
  body: DenisChatBody;
  ctx: DenisTurnContext;
  reflexTurn: ReflexTurnResult;
  beliefs: BeliefGraph;
  timelineEnabled: boolean;
  orgId: string;
}): Promise<TdePerceiveResult> {
  const tdeBeliefs = input.beliefs as Parameters<
    typeof decideTurnPlan
  >[0]["beliefs"];

  const turnPlan = decideTurnPlan({
    beliefs: tdeBeliefs,
    reflex: input.reflexTurn,
    message: input.body.message,
  });

  const interpretationTask = buildInterpretationTask(
    input.reflexTurn.plan.topGoal,
    tdeBeliefs
  );

  const utterancePlan = planUtterance({
    beliefs: tdeBeliefs,
    turnPlan,
    topGoal: input.reflexTurn.plan.topGoal,
  });

  let templateMessage = !turnPlan.requiresLlm
    ? tryTemplateUtterance(utterancePlan)
    : null;

  if (
    (turnPlan.reason === "commerce.status.open_order" ||
      turnPlan.reason === "commerce.post_order.settling") &&
    input.ctx.tableSessionState?.commerce.orders.length
  ) {
    const { openOrderStatusGuestMessage } = await import(
      "@/lib/guest/denis-guest-recovery"
    );
    const statusMessage = openOrderStatusGuestMessage(
      input.ctx.tableSessionState.commerce.orders,
      input.body.language
    );
    if (statusMessage) {
      if (turnPlan.reason === "commerce.post_order.settling") {
        const thanks =
          templateMessage ??
          defaultGuestChatFallback(input.body.language);
        templateMessage = `${statusMessage}\n\n${thanks}`;
      } else {
        templateMessage = statusMessage;
      }
    }
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
  const leadershipContext = {
    inOrderingFlow:
      pressure === "open" ||
      pressure === "confirm" ||
      turnPlan.kind === "transactional_perceive" ||
      cartLineCount > 0,
    awaitingAnswer: awaiting != null && awaiting !== "",
    transactionalTurn: turnPlan.kind === "transactional_perceive",
    hasPriorMessages: (transcriptForTurn?.length ?? 0) > 0,
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
    };
  }

  const manifestBundle = await loadVenueManifestsForLocation(input.body.locationId);
  const { profile, effective } = resolveRuntimeProfile(
    input.ctx.config,
    manifestBundle.locationRaw,
    manifestBundle.orgRaw
  );

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
    }),
    loadTurnPlaybookBlock({
      orgId: input.orgId,
      locationId: input.body.locationId,
      playbookPackId: effective.playbookPackId,
    }).catch(() => null),
  ]);

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
    catalog,
    menuRagEmbeddings,
    menuRagQueryVector,
    playbookBlock,
    vkgPairingBlock,
  });

  const response = await perceiveGuestChatTurn(input.body, {
    turnPlan,
    interpretationTask,
    evidence,
    perceiveMode,
    leadershipContext,
    model: resolvePerceiveModel(profile, perceiveMode),
  });

  return {
    response,
    turnPlan,
    llmUsed: true,
    planKind: turnPlan.kind,
    tier: profile.tier,
    evidencePointers: evidence.pointers,
  };
}

type PerceiveChatPayload = {
  data?: {
    sessionId?: string;
    message?: string;
    intent?: string;
    recommendations?: Array<{ productName?: string; name?: string }>;
    cartActions?: Array<{ productName: string; quantity?: number }>;
    quickReplies?: string[];
    submitOrder?: boolean;
    creditsRemaining?: number;
    creditsCharged?: number;
    structuredPerception?: AiStructuredResponse;
  };
};

/**
 * Denis PPAN+ entry — perceive → plan → act → tell → timeline (G4 single loop).
 */
export async function runDenisTurn(input: DenisTurnRunInput): Promise<Response> {
  if (!isSupportedTurnChannel(input.channel)) {
    return apiError("Unsupported channel.", 400);
  }

  const parsed =
    input.channel === "voice"
      ? parseDenisVoiceBody(input.rawBody)
      : parseDenisChatBody(input.rawBody);
  if (!parsed.ok) {
    return parsed.response;
  }

  const admin = createAdminClient();
  const traceId = createTurnTraceId();
  const turnStarted = performance.now();
  const timings = emptyTurnTimings();
  let shadowParityScore: number | undefined;

  const orgResult = await resolveAiTurnOrg(admin, {
    locationId: parsed.data.locationId,
    tableId: parsed.data.tableId,
    sessionToken: parsed.data.sessionToken,
  });
  if (!orgResult.ok) {
    return apiError(orgResult.error, orgResult.status);
  }

  const creditCheck = await assertSufficientCredits(admin, orgResult.data.orgId);
  if (!creditCheck.ok) {
    return apiError("insufficient_credits", 402);
  }

  const ctxStarted = performance.now();
  let ctx = await buildDenisTurnContext(admin, parsed.data);
  timings.contextMs = elapsedMs(ctxStarted);

  const chatAiSessionId = resolveCanonicalChatAiSessionId(
    ctx.config.party.mode,
    ctx.draftAiSessionId,
    parsed.data.sessionId
  );

  const earlyTimelineAiSessionId = chatAiSessionId ?? ctx.draftAiSessionId ?? null;
  if (earlyTimelineAiSessionId && ctx.tableSessionState) {
    const earlyBackfill = await maybeBackfillPlacementCart({
      admin,
      timelineAiSessionId: earlyTimelineAiSessionId,
      locationId: parsed.data.locationId,
      userMessage: parsed.data.message,
      cartDraft: ctx.aiCartState.draft,
      timeline: ctx.tableSessionState.timeline,
    });
    const cartChanged = earlyBackfill.cartDraft !== ctx.aiCartState.draft;
    if (cartChanged) {
      ctx = {
        ...ctx,
        aiCartState: {
          ...ctx.aiCartState,
          draft: earlyBackfill.cartDraft,
        },
        tableSessionState: {
          ...ctx.tableSessionState,
          commerce: {
            ...ctx.tableSessionState.commerce,
            cart: {
              ...ctx.tableSessionState.commerce.cart,
              ai: {
                ...ctx.tableSessionState.commerce.cart.ai,
                draft: earlyBackfill.cartDraft,
              },
            },
          },
        },
      };
    }

    if (ctx.tableSessionState && earlyBackfill.cartDraft.items.length > 0) {
      const quickObligation = mergeTableSessionObligation({
        state: ctx.tableSessionState,
        source: "turn",
        guestMessage: parsed.data.message,
        cartLines: earlyBackfill.cartDraft.items,
        language: parsed.data.language,
      });
      if (quickObligation.canConfirm) {
        const tableSessionState = ctx.tableSessionState;
        ctx = {
          ...ctx,
          flowNodeId: "recap",
          tableSessionState: {
            ...tableSessionState,
            conversation: {
              ...tableSessionState.conversation,
              flowNodeId: "recap",
              model: {
                ...tableSessionState.conversation.model,
                awaiting: "confirm",
              },
            },
          },
        };
      }
    }
  }

  const perceiveBody =
    chatAiSessionId != null
      ? { ...parsed.data, sessionId: chatAiSessionId }
      : parsed.data;

  const beliefGraph = ctx.tableSessionState
    ? compileBeliefs({
        state: ctx.tableSessionState,
        guestMessage: parsed.data.message,
        sessionLanguage: parsed.data.language,
      })
    : null;

  if (
    ctx.draftAiSessionId &&
    ctx.foldMeta &&
    kernelTimelineEnabled(resolveEffectiveRollout(ctx.config).mode)
  ) {
    await appendMindFoldCompleted(admin, {
      aiSessionId: ctx.draftAiSessionId,
      traceId,
      meta: ctx.foldMeta,
    });

    if (beliefGraph) {
      await appendMindBeliefsCompiled(admin, {
        aiSessionId: ctx.draftAiSessionId,
        traceId,
        graph: beliefGraph,
        truthHash: ctx.foldMeta.truthHash,
      });
    }
  }

  if (input.channel === "voice" && !ctx.config.surfaces.voiceEnabled) {
    return apiError("Voice is not enabled for this location.", 403);
  }

  const timelineSurface: TurnEnvelope["surface"] =
    input.channel === "voice" ? "voice" : "chat";
  const perceptionChannel: PerceptionChannel =
    input.channel === "voice" ? "voice.transcript" : "chat.message";

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

  const slotExtract = shouldRunSlotExtract(ctx.config, reflexTurn)
    ? await extractOrderSlots({
        utterance: parsed.data.message,
        language: parsed.data.language,
        config: ctx.config,
      })
    : null;

  const rollout = resolveEffectiveRollout(ctx.config);
  const timelineEnabled = kernelTimelineEnabled(rollout.mode);

  const pendingSlot = beliefGraph
    ? getBeliefValue<string>(beliefGraph, CORE_BELIEF_KEYS.commercePendingSlot)
    : null;
  const aiSessionId = chatAiSessionId ?? null;
  const { profile } = resolveRuntimeProfile(ctx.config);

  const hasPendingDraft =
    Boolean(aiSessionId) &&
    (await sessionDraftHasPendingSlot(admin, aiSessionId!));

  const perceiveStarted = performance.now();
  let perceiveResult: TdePerceiveResult;

  if ((pendingSlot || hasPendingDraft) && aiSessionId) {
    const slotAct = await tryResolvePendingSlotAct({
      admin,
      sessionId: aiSessionId,
      locationId: parsed.data.locationId,
      userMessage: parsed.data.message,
      language: parsed.data.language,
      pendingSlot: pendingSlot ?? "serve_size",
    });

    if (slotAct.resolved) {
      perceiveResult = buildPendingSlotActPerceiveResult(
        slotAct,
        ctx.opsEffects?.skipUpsell ?? false,
        profile.tier
      );
    } else {
      perceiveResult = await runTdePerceive({
        body: perceiveBody,
        ctx,
        reflexTurn,
        beliefs: beliefGraph ?? { beliefs: [] },
        timelineEnabled,
        orgId: orgResult.data.orgId,
      });
    }
  } else {
    perceiveResult = await runTdePerceive({
      body: perceiveBody,
      ctx,
      reflexTurn,
      beliefs: beliefGraph ?? { beliefs: [] },
      timelineEnabled,
      orgId: orgResult.data.orgId,
    });
  }
  const perceiveResponse = perceiveResult.response;
  timings.legacyMs = elapsedMs(perceiveStarted);
  if (perceiveResponse.status !== 200) {
    return perceiveResponse;
  }

  const payload = (await perceiveResponse.json()) as PerceiveChatPayload;
  const data = payload.data;

  if (!data?.message?.trim() && !reflexTurn.handoffCommand) {
    return perceiveResponse;
  }
  if (!data) {
    return perceiveResponse;
  }

  const timelineAiSessionId = chatAiSessionId ?? data.sessionId ?? null;

  const t0ConfirmSubmit =
    reflexTurn.reflex?.intent === "CONFIRM" &&
    reflexTurn.plan.skills.some((skill) => skill.id === "order.submit");

  if (
    t0ConfirmSubmit ||
    perceiveResult.turnPlan.reason === "commerce.confirm.reflex_submit"
  ) {
    data.submitOrder = true;
  }

  if (timelineEnabled && aiSessionId && beliefGraph) {
    await appendMindTurnProfile(admin, {
      aiSessionId,
      traceId,
      truthHash: ctx.foldMeta?.truthHash,
      profile: buildTurnProfile({
        turnPlan: perceiveResult.turnPlan,
        llmUsed: perceiveResult.llmUsed,
        tier: perceiveResult.tier,
        beliefs: beliefGraph,
        evidencePointers: perceiveResult.evidencePointers,
        pendingSlotActResolved: perceiveResult.pendingSlotActResolved,
      }),
    });
  }

  let cartDraftForAct =
    perceiveResult.cartDraftFromAct ?? ctx.aiCartState.draft;
  const actSubmitLive = isActSubmitLive(ctx.config);
  const pendingSlotActApplied = perceiveResult.pendingSlotActResolved === true;

  if (
    data.structuredPerception &&
    timelineAiSessionId &&
    !pendingSlotActApplied &&
    perceiveResult.llmUsed
  ) {
    const ordered = await applyStructuredPerceptionOrdering({
      admin,
      sessionId: timelineAiSessionId,
      locationId: parsed.data.locationId,
      userMessage: parsed.data.message,
      language: parsed.data.language,
      structured: data.structuredPerception,
      timelineEnabled,
      fallbackDraft: cartDraftForAct,
      traceId,
    });

    if (ordered) {
      cartDraftForAct = ordered.cartDraft;
      data.message = ordered.message || data.message;
      data.cartActions = ordered.cartActions;
      data.quickReplies = ordered.quickReplies;
      data.intent = ordered.intent;
      data.submitOrder = ordered.submitOrder;
    }
  }

  if (timelineAiSessionId && !pendingSlotActApplied) {
    const backfill = await maybeBackfillPlacementCart({
      admin,
      timelineAiSessionId,
      locationId: parsed.data.locationId,
      userMessage: parsed.data.message,
      cartDraft: cartDraftForAct,
      timeline: ctx.tableSessionState?.timeline,
    });

    cartDraftForAct = backfill.cartDraft;
    if (backfill.cartActions.length > 0) {
      data.cartActions = [
        ...(data.cartActions ?? []),
        ...backfill.cartActions,
      ];
    }
  }

  if (
    timelineAiSessionId &&
    !pendingSlotActApplied &&
    (await sessionDraftHasPendingSlot(admin, timelineAiSessionId))
  ) {
    const retryAct = await tryResolvePendingSlotAct({
      admin,
      sessionId: timelineAiSessionId,
      locationId: parsed.data.locationId,
      userMessage: parsed.data.message,
      language: parsed.data.language,
      pendingSlot: pendingSlot ?? "serve_size",
    });

    if (retryAct.resolved) {
      cartDraftForAct = retryAct.cartDraft;
      data.message = retryAct.message;
      data.cartActions = [
        ...(data.cartActions ?? []),
        ...retryAct.cartActions,
      ];
      data.quickReplies = retryAct.quickReplies;
      data.intent = retryAct.intent;
      data.structuredPerception = retryAct.structuredPerception;
      data.submitOrder = retryAct.structuredPerception.submitOrder ?? false;
    }
  }

  const waiterObligation = ctx.tableSessionState
    ? mergeTableSessionObligation({
        state: ctx.tableSessionState,
        source: "turn",
        guestMessage: parsed.data.message,
        cartLines: cartDraftForAct.items,
        pendingSlot:
          (pendingSlot as PendingSlotKind | null) ??
          ctx.tableSessionState.conversation.pendingSlot ??
          null,
        language: parsed.data.language,
        atRecap: ctx.flowNodeId === "recap" || ctx.flowNodeId === "submit",
      })
    : assessWaiterObligation({
        guestMessage: parsed.data.message,
        orderContextMessage: lastOrderPlacementFromTranscript([]),
        cartLines: cartDraftForAct.items,
        pendingSlot: (pendingSlot as PendingSlotKind | null) ?? null,
        language: parsed.data.language,
        atRecap: ctx.flowNodeId === "recap" || ctx.flowNodeId === "submit",
      });

  if (data.submitOrder && !waiterObligation.canConfirm) {
    data.submitOrder = false;
  }

  let actPhase: Awaited<ReturnType<typeof executeActPhase>> = {
    enabled: false,
    dryRun: true,
    results: [],
  };
  const shouldRunAct =
    ctx.config.ordering.actLayerEnabled ||
    (handoffActEnabled(ctx.config) && reflexTurn.handoffCommand !== null);

  if (shouldRunAct) {
    let catalog;
    const legacyWantsSubmit = Boolean(data.submitOrder);
    const needsCatalog = actSubmitLive && legacyWantsSubmit;
    if (needsCatalog) {
      try {
        catalog = await getCachedMenuForLocation(parsed.data.locationId);
      } catch {
        catalog = undefined;
      }
    }

    const actStarted = performance.now();
    actPhase = await executeActPhase({
      config: ctx.config,
      reflexTurn,
      aiSessionId: timelineAiSessionId ?? undefined,
      tableId: parsed.data.tableId,
      locationId: parsed.data.locationId,
      tableToken: parsed.data.sessionToken,
      sessionToken: parsed.data.tableSessionToken ?? parsed.data.sessionToken,
      deviceFingerprint: parsed.data.deviceFingerprint ?? undefined,
      deviceToken: parsed.data.deviceToken ?? undefined,
      cartDraft: cartDraftForAct,
      catalog,
      legacySubmitOrder: legacyWantsSubmit,
    });
    timings.actMs = elapsedMs(actStarted);
  }

  const actSubmitOutcome = resolveActSubmitOutcome(actPhase);

  let turnSubmitOutcome = actSubmitOutcome;
  const shouldRunUnifiedSubmit =
    Boolean(data.submitOrder) &&
    !turnSubmitOutcome.orderId &&
    Boolean(timelineAiSessionId) &&
    (!turnSubmitOutcome.attempted || Boolean(turnSubmitOutcome.submitError));

  if (shouldRunUnifiedSubmit && timelineAiSessionId) {
    const unifiedStarted = performance.now();
    turnSubmitOutcome = await executeTurnOrderSubmit(admin, {
      aiSessionId: timelineAiSessionId,
      locationId: parsed.data.locationId,
      tableToken: parsed.data.sessionToken,
      sessionToken: parsed.data.tableSessionToken ?? parsed.data.sessionToken,
      deviceFingerprint: parsed.data.deviceFingerprint,
      deviceToken: parsed.data.deviceToken,
      cartDraft: cartDraftForAct,
    });
    timings.actMs = (timings.actMs ?? 0) + elapsedMs(unifiedStarted);
  }

  if (
    actSubmitOutcome.attempted &&
    actSubmitOutcome.orderId &&
    timelineAiSessionId &&
    turnSubmitOutcome.orderId === actSubmitOutcome.orderId
  ) {
    await persistAiSessionAfterOrderSubmit(admin, {
      aiSessionId: timelineAiSessionId,
      orderId: actSubmitOutcome.orderId,
      orderNumber: actSubmitOutcome.orderNumber,
      awaitingApproval: actSubmitOutcome.awaitingApproval,
      source: "denis_act_acl",
    });
  }

  const actHandoffOutcome = await runHandoffAclFallback(admin, {
    config: ctx.config,
    reflexTurn,
    parsed: parsed.data,
    language: parsed.data.language,
    actHandoffOutcome: resolveActHandoffOutcome(actPhase, parsed.data.language),
  });
  const actOrderChangeOutcome = resolveActOrderChangeOutcome(
    actPhase,
    parsed.data.language
  );

  const guestUsesLegacy = resolveGuestLegacyPath(rollout.mode, {
    cohortKey: parsed.data.sessionToken,
    canaryPercent: ctx.config.rollout.canaryPercent,
  });

  const narrationFacts = buildNarrationFacts({
    config: ctx.config,
    language: parsed.data.language,
    reflexTurn,
    flowNodeId: ctx.flowNodeId,
    guestMemory: ctx.guestMemory,
    cartActions: data.cartActions,
    recommendations: data.recommendations,
    orderNumber: turnSubmitOutcome.orderNumber ?? null,
    statusSummary: buildCommerceStatusSummary(
      ctx.tableSessionState?.commerce.orders ?? []
    ),
    blockedReason: turnSubmitOutcome.guestBlockedReason ?? null,
    handoffMessage:
      actOrderChangeOutcome.guestMessage ??
      actHandoffOutcome.guestMessage ??
      null,
    venueOps: ctx.venueOps,
    opsEffects: ctx.opsEffects,
  });

  const narrateStarted = performance.now();
  const templateObligationTell =
    !perceiveResult.llmUsed &&
    (perceiveResult.turnPlan.reason === "waiter.gap_clarify" ||
      perceiveResult.turnPlan.reason === "waiter.gap_blocks_confirm" ||
      perceiveResult.turnPlan.reason === "waiter.gap_resolved.drink_reply" ||
      perceiveResult.turnPlan.reason === "commerce.confirm.reflex_submit");

  const resolvedNarration = await resolveTurnNarrationMessage({
    legacyMessage: data.message ?? "",
    facts: narrationFacts,
    config: ctx.config,
    rolloutMode: rollout.mode,
    guestUsesLegacy,
    keepLegacyTell: templateObligationTell,
  });
  const narration = resolvedNarration.usedDenisNarrator
    ? sanitizeNarrationOutput(resolvedNarration.draftMessage, narrationFacts)
    : {
        message: resolvedNarration.draftMessage.trim(),
        tier: "legacy" as const,
        lintPassed: true,
        issues: [],
        usedFallback: false,
      };
  const quickReplies = dedupeHandoffQuickReplies(
    resolveTurnQuickReplies({
      reflexTurn,
      facts: narrationFacts,
      narration,
      legacyQuickReplies: data.quickReplies,
      language: parsed.data.language,
    }),
    actHandoffOutcome.quickReplies
  );
  const cartChangedThisTurn = (data.cartActions?.length ?? 0) > 0;
  let guestMessage =
    actOrderChangeOutcome.overrideLegacy && actOrderChangeOutcome.guestMessage
      ? actOrderChangeOutcome.guestMessage
      : actHandoffOutcome.overrideLegacy && actHandoffOutcome.guestMessage
        ? actHandoffOutcome.guestMessage
        : (pendingSlotActApplied || cartChangedThisTurn) && data.message?.trim()
          ? data.message
          : !resolvedNarration.usedDenisNarrator
            ? data.message
            : narration.message;

  if (turnSubmitOutcome.orderId) {
    guestMessage = orderSubmitSuccessMessage({
      language: parsed.data.language,
      orderNumber: turnSubmitOutcome.orderNumber,
      awaitingApproval: turnSubmitOutcome.awaitingApproval,
    });
  } else if (turnSubmitOutcome.guestBlockedReason && !turnSubmitOutcome.orderId) {
    guestMessage = turnSubmitOutcome.guestBlockedReason;
  } else if (
    Boolean(data.submitOrder) &&
    actSubmitLive &&
    !turnSubmitOutcome.attempted
  ) {
    guestMessage = orderSubmitNotAttemptedMessage(parsed.data.language);
  }

  const hasOpenOrders = (ctx.tableSessionState?.commerce.orders ?? []).some(
    (order) => order.status !== "delivered" && order.status !== "cancelled"
  );
  guestMessage = sanitizeGuestOrderHonesty({
    message: guestMessage ?? "",
    language: parsed.data.language,
    orderSubmitted: Boolean(turnSubmitOutcome.orderId),
    draft: cartDraftToAiOrderDraft(cartDraftForAct),
  });

  if (!turnSubmitOutcome.orderId && waiterObligation.gaps.length > 0) {
    const tellBase =
      !waiterObligation.canConfirm &&
      guestMessage &&
      /\b(šaljem|saljem|send(ing)? (your )?order)\b/i.test(guestMessage)
        ? ""
        : (guestMessage ?? "");
    guestMessage = enforceWaiterTell({
      message: tellBase,
      obligation: waiterObligation,
      language: parsed.data.language,
      draft: cartDraftToAiOrderDraft(cartDraftForAct),
    });
  }

  timings.narrateMs = elapsedMs(narrateStarted);

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
        slotItemCount: slotExtract?.items.length ?? 0,
      },
    });
    logger.info("Denis shadow diff", {
      traceId,
      rolloutMode: rollout.mode,
      parityScore: shadowDiff.parityScore,
      mismatches: shadowDiff.mismatches,
      slotItemCount: slotExtract?.items.length ?? 0,
      slotTier: slotExtract?.tier ?? null,
    });
    shadowParityScore = shadowDiff.parityScore;
  }

  const deferTimelineForReflexSubmit =
    Boolean(turnSubmitOutcome.orderId) &&
    !perceiveResult.llmUsed &&
    perceiveResult.turnPlan.reason === "commerce.confirm.reflex_submit";

  if (timelineAiSessionId && kernelTimelineEnabled(rollout.mode)) {
    const timelineStarted = performance.now();
    const intent = resolveTurnIntent(
      reflexTurn.reflex?.intent,
      data.intent ?? "UNKNOWN"
    );

    const writeTurnTimeline = async () => {
      await persistDenisTurnTimeline(admin, {
        aiSessionId: timelineAiSessionId,
        locationId: parsed.data.locationId,
        traceId,
        guestMessage: parsed.data.message,
        assistantMessage: guestMessage,
        intent,
        intentTier: guestIntentTierFromReflex(reflexTurn.usedT0),
        narrationTier: narration.tier,
        reflexTurn,
        channel: perceptionChannel,
        timelineSurface,
      });

      const followUp = guestFollowUpFromMessage(parsed.data.message);
      if (followUp) {
        await persistGuestFollowUpRequest(admin, {
          aiSessionId: timelineAiSessionId,
          traceId,
          guestMessage: parsed.data.message,
          delaySeconds: followUp.delaySeconds,
        });
      }

      if (slotExtract && slotExtract.items.length > 0) {
        await appendDenisTimelineEvent(admin, {
          aiSessionId: timelineAiSessionId,
          eventType: "slot.extracted",
          traceId,
          payload: {
            type: "slot.extracted",
            tier: slotExtract.tier,
            itemCount: slotExtract.items.length,
            items: slotExtract.items,
            unmappedSpans: slotExtract.unmappedSpans,
          },
        });
      }

      for (const skillResult of actPhase.results) {
        await appendDenisTimelineEvent(admin, {
          aiSessionId: timelineAiSessionId,
          eventType: "skill.executed",
          traceId,
          payload: {
            type: "skill.executed",
            skillId: skillResult.skillId,
            riskClass: skillResult.riskClass,
            dryRun: skillResult.dryRun,
            ok: skillResult.ok,
            error: skillResult.error ?? null,
            detail: skillResult.detail ?? null,
          },
        });
      }
    };

    if (deferTimelineForReflexSubmit) {
      void writeTurnTimeline().catch((error) => {
        logger.warn("Denis reflex submit timeline write failed", {
          traceId,
          aiSessionId: timelineAiSessionId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    } else {
      await writeTurnTimeline();
    }
    timings.timelineMs = elapsedMs(timelineStarted);
  }

  let creditsRemaining =
    data.creditsRemaining ?? creditCheck.balanceAfter;
  const creditsCharged = data.creditsCharged ?? 0;

  if (timelineAiSessionId && creditsCharged > 0) {
    const meteringStarted = performance.now();
    const metering = await finalizeTurnMetering(admin, {
      orgId: orgResult.data.orgId,
      aiSessionId: timelineAiSessionId,
      traceId,
    });

    if (metering.ok) {
      creditsRemaining = metering.balanceAfter;
      await maybeEnqueueLowBalanceAlert(admin, {
        orgId: orgResult.data.orgId,
        locationId: parsed.data.locationId,
        balanceAfter: metering.balanceAfter,
        traceId,
      });
      void refreshOrgAiOpsProjection(admin, orgResult.data.orgId).catch(
        (error) => {
          logger.warn("Denis turn org_ai_ops refresh failed", {
            orgId: orgResult.data.orgId,
            traceId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      );
    } else {
      logger.error("Denis turn metering finalize failed", {
        traceId,
        aiSessionId: timelineAiSessionId,
        orgId: orgResult.data.orgId,
        code: metering.code,
      });
    }
    timings.meteringMs = elapsedMs(meteringStarted);
  }

  timings.totalMs = elapsedMs(turnStarted);

  logDenisTurnObservability({
    traceId,
    locationId: parsed.data.locationId,
    channel: input.channel,
    rolloutMode: rollout.mode,
    guestUsesLegacy,
    narrationTier: narration.tier,
    lintPassed: narration.lintPassed,
    creditsCharged,
    actDryRun: actPhase.dryRun,
    actEnabled: actPhase.enabled,
    actSubmitLive,
    actSubmitAttempted: turnSubmitOutcome.attempted,
    actOrderNumber: turnSubmitOutcome.orderNumber,
    shadowParityScore,
    llmUsed: perceiveResult.llmUsed,
    planKind: perceiveResult.planKind,
    tier: perceiveResult.tier,
    evidencePointers: perceiveResult.evidencePointers,
    timings,
  });

  const responseData = {
    message: guestMessage,
    recommendations: data.recommendations,
    cartActions: data.cartActions,
    quickReplies,
    intent: data.intent,
    submitOrder: Boolean(turnSubmitOutcome.orderId),
    creditsRemaining,
    sessionId: timelineAiSessionId ?? data.sessionId,
    ...(actHandoffOutcome.openPaymentSheet
      ? { openPaymentSheet: true }
      : {}),
    ...(turnSubmitOutcome.attempted && turnSubmitOutcome.orderId
      ? {
          orderSubmit: {
            orderId: turnSubmitOutcome.orderId,
            orderNumber: turnSubmitOutcome.orderNumber,
            awaitingApproval: turnSubmitOutcome.awaitingApproval ?? false,
            sessionOpened: turnSubmitOutcome.sessionOpened,
          },
        }
      : {}),
  };

  const responseMeta = {
    traceId,
    channel: input.channel,
    flowNodeId: reflexTurn.plan.transition.toNodeId,
    topGoal: reflexTurn.plan.topGoal?.type ?? null,
    conflictPrompt: reflexTurn.conflict?.guestPrompt ?? null,
    narrationTier: narration.tier,
    lintPassed: narration.lintPassed,
    usedNarrationFallback: narration.usedFallback,
    rolloutMode: rollout.mode,
    partyMode: ctx.config.party.mode,
    partyDeviceCount: ctx.party?.activeDeviceCount ?? 0,
    isPrimaryDevice: ctx.party?.isCurrentDevicePrimary ?? false,
    sharedAiSessionId: ctx.party?.sharedAiSessionId ?? null,
    operatingMode: ctx.venueOps?.operatingMode,
    kdsStress: ctx.venueOps?.kdsStress,
    actSubmitLive,
    actSubmitAttempted: turnSubmitOutcome.attempted,
    actOrderNumber: turnSubmitOutcome.orderNumber,
  };

  const tableSessionId = await resolveActiveTableSessionId(admin, {
    tableId: parsed.data.tableId,
    locationId: parsed.data.locationId,
    sessionToken: resolveGuestTableSessionLookupToken(parsed.data),
  });

  if (tableSessionId) {
    const menuCache = await getCachedMenuForLocation(parsed.data.locationId);
    const productNames: Record<string, string> = {};
    if (menuCache?.productMap) {
      for (const [id, product] of Object.entries(menuCache.productMap)) {
        productNames[id] = product.name;
      }
    }

    const sceneOverrides = mapTurnToSceneOverrides({
      tableSessionId,
      quickReplies,
      recommendations: (data.recommendations ?? []) as AiRecommendation[],
      productNames,
      markState: "idle",
      sheetOpen: false,
      thinking: false,
    });

    if (
      turnSubmitOutcome.attempted &&
      turnSubmitOutcome.orderId &&
      turnSubmitOutcome.orderNumber != null
    ) {
      sceneOverrides.proactiveBanner = {
        id: `order-placed-${turnSubmitOutcome.orderId}`,
        message: `#${turnSubmitOutcome.orderNumber}`,
        action: "view_order",
        orderId: turnSubmitOutcome.orderId,
      };
    }

    void scheduleGuestSceneRefresh(admin, sceneOverrides).catch((error) => {
      logger.warn("Denis turn scene refresh failed", {
        traceId,
        tableSessionId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  if (input.channel === "voice") {
    return formatVoiceTurnApiResponse(responseData, responseMeta, {
      speakText: guestMessage,
      ttsRecommended: ctx.config.surfaces.voiceTtsEnabled,
    });
  }

  return formatChatTurnApiResponse(responseData, responseMeta);
}

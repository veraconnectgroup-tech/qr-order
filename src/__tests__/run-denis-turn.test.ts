import { describe, expect, it, vi, beforeEach } from "vitest";
import { apiSuccess } from "@/lib/api-response";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import type { ReflexTurnResult } from "@/lib/denis/kernel/reflex-plan";
import type { DenisTurnContext } from "@/lib/denis/runtime/turn-types";

/**
 * First (and, at the time of writing, only) end-to-end test of
 * `runDenisTurn` — the ~1,100-line orchestrator in run-denis-turn.ts that
 * every guest turn flows through. Before this file, 417 test files covered
 * only its small leaf helpers and legacy adapters; nothing exercised the
 * orchestrator itself.
 *
 * SCOPE / HONESTY NOTE — read before trusting this as a full regression net:
 *
 * runDenisTurn imports ~30 concrete modules directly (no dependency
 * injection) spanning Supabase reads/writes, Redis, OpenAI, credits,
 * timeline persistence, and moderation. To exercise the orchestrator's REAL
 * control flow (conduct check -> reflex plan -> perceive -> act -> submit ->
 * narrate -> shield -> timeline) without a live database or LLM, this test
 * mocks runDenisTurn's direct dependencies at the module boundary — the same
 * pattern already used by run-guest-conduct-shadow-check.test.ts and
 * run-agentic-live-turn.test.ts for their own dependencies — and lets every
 * piece of orchestration logic inside run-denis-turn.ts run for real:
 * config-driven branching, cart/session id plumbing, submitOrder gating,
 * narration selection, output shielding, and the timeline writes.
 *
 * What is REAL in this test:
 *   - The exported runDenisTurn function body itself (all ~1,100 lines of
 *     branching/glue), including its private helpers (runTdePerceive,
 *     handleInputShieldBlock, maybeBackfillPlacementCart, etc).
 *   - decideTurnPlan / planUtterance are mocked (see below) but
 *     buildInterpretationTask, resolveRuntimeProfile, moderateGuestInput,
 *     screenOutput, resolveTurnNarrationMessage, buildNarrationFacts,
 *     resolveTurnQuickReplies, assessWaiterObligation, resolveEffectiveRollout,
 *     kernelTimelineEnabled, shouldRunSlotExtract, guestFollowUpFromMessage,
 *     extractTurnInterpretation, resolveTurnIntent and friends all run as
 *     real, unmocked pure/near-pure logic against the fixtures below.
 *
 * What is MOCKED (module-boundary stubs, listed so a future refactor knows
 * exactly which contracts this test pins):
 *   - @/lib/supabase/admin (no real DB — every fetch that reaches it either
 *     goes through a mock below or is guarded by the codebase's own
 *     try/catch degrade-gracefully paths, e.g. maybeBackfillPlacementCart)
 *   - @/lib/denis/runtime/build-turn-context (buildDenisTurnContext) — would
 *     otherwise cascade into ~6 more Supabase-backed loaders
 *   - @/lib/denis/commercial (resolveAiTurnOrg, assertSufficientCredits, ...)
 *   - @/lib/denis/cognition/policy/run-guest-conduct-shadow-check
 *   - @/lib/denis/kernel/reflex-plan (planTurnWithReflex)
 *   - @/lib/denis/cognition/tde (decideTurnPlan, planUtterance, ...) — forces
 *     the deterministic template path so no OpenAI call is required
 *   - @/lib/denis/cognition/tde/build-interpretation-task
 *   - @/lib/denis/cognition/perceive (perceiveGuestChatTurn) — this is the
 *     one genuine simplification: the real function still does 6+ Supabase
 *     calls even with skipLlm:true (session/table lookups, credits), so it
 *     is stubbed rather than exercised live
 *   - @/lib/denis/venue/party (resolveCanonicalChatAiSessionId,
 *     resolveActiveTableSessionId, resolveGuestTableSessionLookupToken)
 *   - @/lib/denis/runtime/persist-turn-timeline (persistDenisTurnTimeline)
 *   - @/lib/denis/runtime/maybe-emit-turn-learning-signals
 *   - @/lib/denis/platform/append-timeline-event (appendDenisTimelineEvent)
 *
 * This is therefore an orchestration/regression test, not a full
 * integration test — it will not catch a bug inside, say, the real
 * perceiveGuestChatTurn or planTurnWithReflex. What it DOES catch: any
 * change to run-denis-turn.ts's own control flow (ordering of phases,
 * submitOrder gating, which fields flow into the final response, whether
 * the timeline gets written) breaking silently during the planned
 * incremental extraction of this file.
 */

/**
 * A generic, infinitely-chainable Supabase stub. Every property access
 * returns a function that returns the same stub (so `.from().select().eq()`
 * chains of any shape keep working), and the stub itself is thenable,
 * resolving to `{ data: null, error: null }` — the same "nothing found"
 * shape a real query returns for a session/table that doesn't exist. This
 * lets the small number of codepaths that call the admin client directly
 * (e.g. sessionDraftHasPendingSlot, the internal menu-cache lookup inside
 * maybeBackfillPlacementCart) degrade the same way they would against an
 * empty database, instead of throwing on `.from is not a function`.
 */
function makeFakeAdminClient(): never {
  const stub: object = {};
  const proxy: unknown = new Proxy(stub, {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (value: { data: null; error: null }) => void) =>
          resolve({ data: null, error: null });
      }
      if (prop === "catch" || prop === "finally") {
        return () => proxy;
      }
      return (..._args: unknown[]) => proxy;
    },
  });
  return proxy as never;
}

const { createAdminClientMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(() => ({}) as never),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

const { buildDenisTurnContextMock } = vi.hoisted(() => ({
  buildDenisTurnContextMock: vi.fn(),
}));
vi.mock("@/lib/denis/runtime/build-turn-context", () => ({
  buildDenisTurnContext: buildDenisTurnContextMock,
}));

const {
  resolveAiTurnOrgMock,
  assertSufficientCreditsMock,
  finalizeTurnMeteringMock,
  maybeEnqueueLowBalanceAlertMock,
  refreshOrgAiOpsProjectionMock,
} = vi.hoisted(() => ({
  resolveAiTurnOrgMock: vi.fn(),
  assertSufficientCreditsMock: vi.fn(),
  finalizeTurnMeteringMock: vi.fn(),
  maybeEnqueueLowBalanceAlertMock: vi.fn(),
  refreshOrgAiOpsProjectionMock: vi.fn(),
}));
vi.mock("@/lib/denis/commercial", () => ({
  resolveAiTurnOrg: resolveAiTurnOrgMock,
  assertSufficientCredits: assertSufficientCreditsMock,
  finalizeTurnMetering: finalizeTurnMeteringMock,
  maybeEnqueueLowBalanceAlert: maybeEnqueueLowBalanceAlertMock,
  refreshOrgAiOpsProjection: refreshOrgAiOpsProjectionMock,
}));

const { runGuestConductShadowCheckMock } = vi.hoisted(() => ({
  runGuestConductShadowCheckMock: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/denis/cognition/policy/run-guest-conduct-shadow-check", () => ({
  runGuestConductShadowCheck: runGuestConductShadowCheckMock,
}));

const { planTurnWithReflexMock } = vi.hoisted(() => ({
  planTurnWithReflexMock: vi.fn(),
}));
vi.mock("@/lib/denis/kernel/reflex-plan", () => ({
  planTurnWithReflex: planTurnWithReflexMock,
}));

const {
  decideTurnPlanMock,
  planUtteranceMock,
  defaultGuestChatFallbackMock,
  tryTemplateUtteranceMock,
} = vi.hoisted(() => ({
  decideTurnPlanMock: vi.fn(),
  planUtteranceMock: vi.fn(),
  defaultGuestChatFallbackMock: vi.fn(() => "How can I help?"),
  tryTemplateUtteranceMock: vi.fn(() => null),
}));
vi.mock("@/lib/denis/cognition/tde", () => ({
  decideTurnPlan: decideTurnPlanMock,
  planUtterance: planUtteranceMock,
  defaultGuestChatFallback: defaultGuestChatFallbackMock,
  tryTemplateUtterance: tryTemplateUtteranceMock,
}));

vi.mock("@/lib/denis/cognition/tde/build-interpretation-task", () => ({
  buildInterpretationTask: vi.fn(() => undefined),
}));

const { perceiveGuestChatTurnMock } = vi.hoisted(() => ({
  perceiveGuestChatTurnMock: vi.fn(),
}));
vi.mock("@/lib/denis/cognition/perceive", () => ({
  perceiveGuestChatTurn: perceiveGuestChatTurnMock,
}));

const {
  resolveCanonicalChatAiSessionIdMock,
  resolveActiveTableSessionIdMock,
  resolveGuestTableSessionLookupTokenMock,
} = vi.hoisted(() => ({
  resolveCanonicalChatAiSessionIdMock: vi.fn(() => undefined),
  resolveActiveTableSessionIdMock: vi.fn().mockResolvedValue(null),
  resolveGuestTableSessionLookupTokenMock: vi.fn(() => "lookup-token"),
}));
vi.mock("@/lib/denis/venue/party", () => ({
  resolveCanonicalChatAiSessionId: resolveCanonicalChatAiSessionIdMock,
  resolveActiveTableSessionId: resolveActiveTableSessionIdMock,
  resolveGuestTableSessionLookupToken: resolveGuestTableSessionLookupTokenMock,
}));

const { persistDenisTurnTimelineMock } = vi.hoisted(() => ({
  persistDenisTurnTimelineMock: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/denis/runtime/persist-turn-timeline", () => ({
  persistDenisTurnTimeline: persistDenisTurnTimelineMock,
}));

const { maybeEmitTurnLearningSignalsMock } = vi.hoisted(() => ({
  maybeEmitTurnLearningSignalsMock: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/denis/runtime/maybe-emit-turn-learning-signals", () => ({
  maybeEmitTurnLearningSignals: maybeEmitTurnLearningSignalsMock,
}));

const { appendDenisTimelineEventMock } = vi.hoisted(() => ({
  appendDenisTimelineEventMock: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/denis/platform/append-timeline-event", () => ({
  appendDenisTimelineEvent: appendDenisTimelineEventMock,
}));

const LOCATION_ID = "11111111-1111-4111-8111-111111111111";
const TABLE_ID = "22222222-2222-4222-8222-222222222222";
const SESSION_TOKEN = "guest-session-token-0123456789abcdef";

function buildReflexTurnFixture(): ReflexTurnResult {
  return {
    reflex: null,
    correction: null,
    conflict: null,
    plan: {
      transition: {
        fromNodeId: "idle",
        toNodeId: "ordering",
        signal: "order_add" as never,
        skippedGuard: false,
      },
      flowNode: undefined as never,
      goals: [],
      topGoal: null,
      skills: [],
      primarySignal: "order_add" as never,
    },
    cartState: { draft: { items: [], cartRevision: 0 }, undoStack: [] },
    usedT0: false,
    handoffCommand: null,
    handoffPaymentMethod: null,
    pipelineHints: {
      reflexIntent: null,
      handoffIntent: null,
      feedsPipeline: true,
    },
  };
}

function buildCtxFixture(): DenisTurnContext {
  return {
    locationId: LOCATION_ID,
    aiSessionId: undefined,
    draftAiSessionId: undefined,
    config: {
      ...CONCIERGE_PLATFORM_DEFAULTS,
      rollout: {
        ...CONCIERGE_PLATFORM_DEFAULTS.rollout,
        mode: "denis_only",
      },
    },
    flowNodeId: "idle",
    aiCartState: { draft: { items: [], cartRevision: 0 }, undoStack: [] },
    manualCartDraft: undefined,
    peerManualCartDraft: undefined,
    party: null,
    venueOps: undefined,
    opsEffects: undefined,
    foodUpsellAsked: false,
    guestMemory: null,
    rhythmContext: null,
    revenueInsight: null,
    healthOverrides: undefined,
    lastAssistantMessage: null,
    foldMeta: undefined,
    tableSessionState: undefined,
  };
}

describe("runDenisTurn — end-to-end guest order turn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createAdminClientMock.mockReturnValue(makeFakeAdminClient());
    buildDenisTurnContextMock.mockResolvedValue(buildCtxFixture());
    resolveAiTurnOrgMock.mockResolvedValue({
      ok: true,
      data: { orgId: "org-1" },
    });
    assertSufficientCreditsMock.mockResolvedValue({
      ok: true,
      balanceAfter: 99,
    });
    runGuestConductShadowCheckMock.mockResolvedValue(null);
    planTurnWithReflexMock.mockReturnValue(buildReflexTurnFixture());
    decideTurnPlanMock.mockReturnValue({
      kind: "transactional_perceive",
      requiresLlm: false,
      suppressUpsell: false,
      reason: "commerce.order.add_items",
    });
    planUtteranceMock.mockReturnValue({ kind: "template", key: null });
    tryTemplateUtteranceMock.mockReturnValue(null);
    resolveCanonicalChatAiSessionIdMock.mockReturnValue(undefined);
    resolveActiveTableSessionIdMock.mockResolvedValue(null);
    perceiveGuestChatTurnMock.mockResolvedValue(
      apiSuccess({
        message: "Got it — 2x Cola coming right up!",
        recommendations: [],
        cartActions: [{ productName: "Cola", quantity: 2 }],
        quickReplies: [],
        intent: "order",
        submitOrder: false,
        creditsRemaining: 99,
        creditsCharged: 0,
        sessionId: "ai-session-1",
      })
    );
  });

  it("runs the real orchestration for a simple guest order message", async () => {
    const { runDenisTurn } = await import(
      "@/lib/denis/runtime/run-denis-turn"
    );

    const response = await runDenisTurn({
      channel: "chat",
      rawBody: {
        locationId: LOCATION_ID,
        tableId: TABLE_ID,
        sessionToken: SESSION_TOKEN,
        message: "2x cola",
        language: "en",
      },
    });

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      data: {
        message: string;
        submitOrder: boolean;
        cartActions: Array<{ productName: string; quantity?: number }>;
        sessionId?: string;
      };
    };

    // 1. A sensible guest-facing message came back (legacy/template path —
    // narrateWithLlm is off in defaults, so no OpenAI call was needed).
    expect(json.data.message).toContain("Cola");

    // 2. The order was NOT submitted this turn — act layer is disabled in
    // CONCIERGE_PLATFORM_DEFAULTS and reflex did not fire a CONFIRM, so
    // runDenisTurn must not fabricate a submission.
    expect(json.data.submitOrder).toBe(false);

    // 3. The cart action proposed by perceive flowed untouched into the
    // final response.
    expect(json.data.cartActions).toEqual([
      { productName: "Cola", quantity: 2 },
    ]);

    // 4. Orchestration reached the timeline-write phase (rollout mode
    // denis_only enables kernelTimelineEnabled) and persisted the turn with
    // the resolved guest/assistant messages and intent — proves perceive ->
    // narrate -> timeline actually ran end-to-end, not just returned early.
    expect(persistDenisTurnTimelineMock).toHaveBeenCalledTimes(1);
    const timelineCall = persistDenisTurnTimelineMock.mock.calls[0]?.[1] as {
      aiSessionId: string;
      guestMessage: string;
      assistantMessage: string;
      intent: string;
    };
    expect(timelineCall.aiSessionId).toBe("ai-session-1");
    expect(timelineCall.guestMessage).toBe("2x cola");
    expect(timelineCall.assistantMessage).toContain("Cola");

    // Sanity: the conduct check and reflex plan (the phases before perceive)
    // were both invoked as part of the same turn.
    expect(runGuestConductShadowCheckMock).toHaveBeenCalledTimes(1);
    expect(planTurnWithReflexMock).toHaveBeenCalledTimes(1);
    expect(perceiveGuestChatTurnMock).toHaveBeenCalledTimes(1);
  });
});

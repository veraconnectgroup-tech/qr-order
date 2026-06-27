import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import type { TurnPhaseTimings } from "@/lib/denis/runtime/turn-observability";

export type TurnTracePhaseTimings = {
  auth: { durationMs: number; orgId: string; creditsRemaining: number };
  context: { durationMs: number; menuItemCount?: number; orderCount?: number };
  beliefs: {
    durationMs: number;
    foldState?: string;
  };
  plan: {
    durationMs: number;
    tier: string;
    planKind: string;
    reflexReason?: string;
  };
  perceive: {
    durationMs: number;
    llmUsed: boolean;
    model?: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  act: {
    durationMs: number;
    cartActions: number;
    obligationFired: boolean;
    submitTriggered: boolean;
  };
  narrate: {
    durationMs: number;
    outputLength: number;
    quickReplies: string[];
  };
};

export type TurnTrace = {
  traceId: string;
  aiSessionId: string;
  locationId: string;
  timestamp: string;
  guestInput: string;
  language: string;
  phases: TurnTracePhaseTimings;
  totalDurationMs: number;
  totalTokens: number;
  estimatedCostUsd: number;
  denisResponse: string;
  denisReasoning?: string;
};

const GPT4O_MINI_INPUT_USD_PER_1M = 0.15;
const GPT4O_MINI_OUTPUT_USD_PER_1M = 0.6;

export function estimateTurnCostUsd(
  promptTokens: number,
  completionTokens: number
): number {
  return (
    (promptTokens / 1_000_000) * GPT4O_MINI_INPUT_USD_PER_1M +
    (completionTokens / 1_000_000) * GPT4O_MINI_OUTPUT_USD_PER_1M
  );
}

export function withTiming<T>(
  fn: () => Promise<T> | T
): Promise<{ result: T; durationMs: number }> {
  const start = performance.now();
  return Promise.resolve(fn()).then((result) => ({
    result,
    durationMs: Math.round(performance.now() - start),
  }));
}

export function buildTurnTrace(input: {
  traceId: string;
  aiSessionId: string;
  locationId: string;
  guestInput: string;
  language: string;
  orgId: string;
  creditsRemaining: number;
  contextMs: number;
  legacyMs: number;
  actMs: number;
  narrateMs: number;
  totalMs: number;
  tier: string;
  planKind: string;
  reflexReason?: string;
  llmUsed: boolean;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  cartActionCount: number;
  submitTriggered: boolean;
  obligationFired: boolean;
  denisResponse: string;
  quickReplies: string[];
  foldState?: string;
  orderCount?: number;
}): TurnTrace {
  const promptTokens = input.promptTokens ?? 0;
  const completionTokens = input.completionTokens ?? 0;
  const totalTokens = promptTokens + completionTokens;

  return {
    traceId: input.traceId,
    aiSessionId: input.aiSessionId,
    locationId: input.locationId,
    timestamp: new Date().toISOString(),
    guestInput: input.guestInput,
    language: input.language,
    phases: {
      auth: {
        durationMs: 0,
        orgId: input.orgId,
        creditsRemaining: input.creditsRemaining,
      },
      context: {
        durationMs: input.contextMs,
        orderCount: input.orderCount,
      },
      beliefs: {
        durationMs: 0,
        foldState: input.foldState,
      },
      plan: {
        durationMs: 0,
        tier: input.tier,
        planKind: input.planKind,
        reflexReason: input.reflexReason,
      },
      perceive: {
        durationMs: input.legacyMs,
        llmUsed: input.llmUsed,
        model: input.model,
        promptTokens,
        completionTokens,
        totalTokens,
      },
      act: {
        durationMs: input.actMs,
        cartActions: input.cartActionCount,
        obligationFired: input.obligationFired,
        submitTriggered: input.submitTriggered,
      },
      narrate: {
        durationMs: input.narrateMs,
        outputLength: input.denisResponse.length,
        quickReplies: input.quickReplies,
      },
    },
    totalDurationMs: input.totalMs,
    totalTokens,
    estimatedCostUsd: estimateTurnCostUsd(promptTokens, completionTokens),
    denisResponse: input.denisResponse,
  };
}

export async function writeTurnTrace(
  admin: SupabaseClient,
  trace: TurnTrace
): Promise<void> {
  const { error } = await admin.from("denis_turn_traces" as never).insert({
    trace_id: trace.traceId,
    ai_session_id: trace.aiSessionId,
    location_id: trace.locationId,
    total_duration_ms: trace.totalDurationMs,
    tier: trace.phases.plan.tier,
    llm_used: trace.phases.perceive.llmUsed,
    total_tokens: trace.totalTokens,
    trace_data: trace as unknown as Record<string, unknown>,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export function scheduleTurnTraceWrite(
  admin: SupabaseClient,
  trace: TurnTrace
): void {
  if (process.env.NODE_ENV === "development") {
    logger.info("denis.turn.trace", {
      traceId: trace.traceId,
      phases: Object.fromEntries(
        Object.entries(trace.phases).map(([key, value]) => [
          key,
          "durationMs" in value ? value.durationMs : value,
        ])
      ),
      totalDurationMs: trace.totalDurationMs,
      totalTokens: trace.totalTokens,
    });
  }

  void writeTurnTrace(admin, trace).catch((error) => {
    logger.warn("Denis turn trace write failed", {
      traceId: trace.traceId,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

export type { TurnPhaseTimings };

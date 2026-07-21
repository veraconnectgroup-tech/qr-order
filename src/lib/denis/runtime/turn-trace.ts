import { createAdminClient } from "@/lib/supabase/admin";
import { toJson } from "@/lib/supabase/json";
import { runAfterResponse } from "@/lib/runtime/run-after-response";
import type { Json } from "@/types/database";

export type BuildTurnTraceInput = {
  traceId: string;
  aiSessionId: string;
  locationId: string;
  guestInput: string;
  language: string;
  orgId?: string;
  creditsRemaining?: number;
  contextMs: number;
  legacyMs: number;
  actMs: number;
  narrateMs: number;
  totalMs: number;
  tier: string;
  planKind: string;
  llmUsed: boolean;
  modelTier?: string;
  model?: string;
  complexityScore?: number;
  cartActionCount: number;
  submitTriggered: boolean;
  obligationFired: boolean;
  denisResponse: string;
  quickReplies: string[];
  inputTokens?: number;
  outputTokens?: number;
};

export type TurnTrace = {
  traceId: string;
  aiSessionId: string;
  locationId: string;
  timestamp: string;
  guestInput: string;
  language: string;
  orgId?: string;
  creditsRemaining?: number;
  totalDurationMs: number;
  totalTokens: number;
  estimatedCostUsd?: number;
  denisResponse?: string;
  phases: {
    context: { durationMs: number };
    perceive: { durationMs: number; llmUsed: boolean; model?: string; modelTier?: string };
    act: {
      durationMs: number;
      cartActions: number;
      submitTriggered: boolean;
      obligationFired: boolean;
    };
    plan: { tier: string; planKind: string; modelTier?: string; reflexReason?: string };
    narrate: {
      durationMs: number;
      outputLength: number;
      quickReplyCount: number;
    };
  };
};

export function buildTurnTrace(input: BuildTurnTraceInput): TurnTrace {
  const inputTokens = input.inputTokens ?? 0;
  const outputTokens = input.outputTokens ?? 0;

  return {
    traceId: input.traceId,
    aiSessionId: input.aiSessionId,
    locationId: input.locationId,
    timestamp: new Date().toISOString(),
    guestInput: input.guestInput,
    language: input.language,
    orgId: input.orgId,
    creditsRemaining: input.creditsRemaining,
    totalDurationMs: input.totalMs,
    totalTokens: inputTokens + outputTokens,
    estimatedCostUsd: estimateTurnCostUsd(inputTokens, outputTokens),
    denisResponse: input.denisResponse,
    phases: {
      context: { durationMs: input.contextMs },
      perceive: {
        durationMs: input.legacyMs,
        llmUsed: input.llmUsed,
        model: input.model,
        modelTier: input.modelTier,
      },
      act: {
        durationMs: input.actMs,
        cartActions: input.cartActionCount,
        submitTriggered: input.submitTriggered,
        obligationFired: input.obligationFired,
      },
      plan: {
        tier: input.tier,
        planKind: input.planKind,
        modelTier: input.modelTier,
      },
      narrate: {
        durationMs: input.narrateMs,
        outputLength: input.denisResponse.length,
        quickReplyCount: input.quickReplies.length,
      },
    },
  };
}

export function estimateTurnCostUsd(
  inputTokens: number,
  outputTokens: number
): number {
  const inputPer1M = 0.15;
  const outputPer1M = 0.6;
  return (
    (inputTokens / 1_000_000) * inputPer1M +
    (outputTokens / 1_000_000) * outputPer1M
  );
}

export async function withTiming<T>(
  fn: () => Promise<T>
): Promise<{ result: T; durationMs: number }> {
  const started = performance.now();
  const result = await fn();
  return {
    result,
    durationMs: Math.max(0, Math.round(performance.now() - started)),
  };
}

export async function writeTurnTrace(trace: TurnTrace): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("denis_turn_traces").insert({
    trace_id: trace.traceId,
    ai_session_id: trace.aiSessionId,
    location_id: trace.locationId,
    total_duration_ms: trace.totalDurationMs,
    tier: trace.phases.plan.tier,
    llm_used: trace.phases.perceive.llmUsed,
    total_tokens: trace.totalTokens,
    trace_data: toJson(trace),
  });

  if (error) throw error;
}

export function scheduleTurnTraceWrite(trace: TurnTrace): void {
  runAfterResponse(() =>
    writeTurnTrace(trace).catch(() => {
      // Observability only — must not affect guest turns.
    })
  );
}

import {
  shouldRunShadowDiff,
  type ConciergeRolloutMode,
} from "@/lib/denis/config/rollout";
import { diffShadowTurn } from "@/lib/denis/runtime/shadow-diff";
import { logger } from "@/lib/logger";

export type LogShadowDiffInput = {
  rolloutMode: ConciergeRolloutMode;
  traceId: string;
  legacy: {
    intent?: string;
    message?: string;
    cartActionCount: number;
    submitOrder?: boolean;
  };
  denis: {
    topGoal: string | null;
    flowNodeId: string;
    skillIds: string[];
    hasConflict: boolean;
    lintPassed: boolean;
    intent: string | null;
  };
  slotItemCount: number;
  slotTier: string | null;
};

export type LogShadowDiffResult = {
  shadowParityScore: number | undefined;
};

/**
 * Denis M10 shadow-mode observability: compares the legacy chat turn against
 * the Denis kernel plan and logs the parity diff. Pure input -> output —
 * the only externally visible effects are the `logger.info` call and the
 * returned parity score, which the caller stores.
 */
export function logShadowDiff(input: LogShadowDiffInput): LogShadowDiffResult {
  if (!shouldRunShadowDiff(input.rolloutMode)) {
    return { shadowParityScore: undefined };
  }

  const shadowDiff = diffShadowTurn({
    legacy: {
      intent: input.legacy.intent,
      message: input.legacy.message,
      cartActionCount: input.legacy.cartActionCount,
      submitOrder: input.legacy.submitOrder,
    },
    denis: {
      topGoal: input.denis.topGoal,
      flowNodeId: input.denis.flowNodeId,
      skillIds: input.denis.skillIds,
      hasConflict: input.denis.hasConflict,
      lintPassed: input.denis.lintPassed,
      intent: input.denis.intent,
      slotItemCount: input.slotItemCount,
    },
  });

  logger.info("Denis shadow diff", {
    traceId: input.traceId,
    rolloutMode: input.rolloutMode,
    parityScore: shadowDiff.parityScore,
    mismatches: shadowDiff.mismatches,
    slotItemCount: input.slotItemCount,
    slotTier: input.slotTier,
  });

  return { shadowParityScore: shadowDiff.parityScore };
}

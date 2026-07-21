import type { SupabaseClient } from "@supabase/supabase-js";
import {
  finalizeTurnMetering,
  maybeEnqueueLowBalanceAlert,
  refreshOrgAiOpsProjection,
} from "@/lib/denis/commercial";
import { logger } from "@/lib/logger";
import { elapsedMs } from "@/lib/denis/runtime/turn-observability";

export type FinalizeTurnCreditsInput = {
  admin: SupabaseClient;
  orgId: string;
  locationId: string;
  timelineAiSessionId: string | null;
  traceId: string;
  /** From the legacy perceive payload — 0 when this turn charged nothing. */
  creditsCharged: number;
  /** Best-known balance before metering finalizes — used verbatim if there's nothing to finalize. */
  creditsRemaining: number;
};

export type FinalizeTurnCreditsResult = {
  creditsRemaining: number;
  meteringMs: number;
};

/**
 * Finalizes this turn's credit charge and returns the resulting balance.
 * A no-op (returns the input balance unchanged) when there's no
 * timelineAiSessionId or nothing was charged — same as the inline
 * `if (timelineAiSessionId && creditsCharged > 0)` guard this replaces.
 */
export async function finalizeTurnCredits(
  input: FinalizeTurnCreditsInput
): Promise<FinalizeTurnCreditsResult> {
  if (!input.timelineAiSessionId || input.creditsCharged <= 0) {
    return { creditsRemaining: input.creditsRemaining, meteringMs: 0 };
  }

  const meteringStarted = performance.now();
  let creditsRemaining = input.creditsRemaining;

  const metering = await finalizeTurnMetering(input.admin, {
    orgId: input.orgId,
    aiSessionId: input.timelineAiSessionId,
    traceId: input.traceId,
  });

  if (metering.ok) {
    creditsRemaining = metering.balanceAfter;
    await maybeEnqueueLowBalanceAlert(input.admin, {
      orgId: input.orgId,
      locationId: input.locationId,
      balanceAfter: metering.balanceAfter,
      traceId: input.traceId,
    });
    void refreshOrgAiOpsProjection(input.admin, input.orgId).catch((error) => {
      logger.warn("Denis turn org_ai_ops refresh failed", {
        orgId: input.orgId,
        traceId: input.traceId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  } else {
    logger.error("Denis turn metering finalize failed", {
      traceId: input.traceId,
      aiSessionId: input.timelineAiSessionId,
      orgId: input.orgId,
      code: metering.code,
    });
  }

  return { creditsRemaining, meteringMs: elapsedMs(meteringStarted) };
}

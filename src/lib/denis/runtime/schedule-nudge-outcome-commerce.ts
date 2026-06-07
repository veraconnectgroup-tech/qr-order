import type { NudgeOutcomeRecord } from "@/lib/denis/cognition/offer/nudge-outcome-types";
import { scheduleDenisAnticipationCommerceProjection } from "@/lib/denis/runtime/schedule-denis-anticipation-commerce";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Project terminal non-accept nudge outcomes to commerce (accept stays on offer.converted). */
export function scheduleNudgeOutcomeCommerceProjection(
  admin: SupabaseClient,
  input: {
    aiSessionId: string;
    tableSessionId?: string;
    traceId?: string;
    outcomes: NudgeOutcomeRecord[];
  }
): void {
  const terminal = input.outcomes.filter((row) => row.outcome !== "accepted");
  if (terminal.length === 0) return;

  scheduleDenisAnticipationCommerceProjection(admin, {
    kind: "nudge_resolved",
    aiSessionId: input.aiSessionId,
    tableSessionId: input.tableSessionId,
    traceId: input.traceId,
    outcomes: terminal,
  });
}

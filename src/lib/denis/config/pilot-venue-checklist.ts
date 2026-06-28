import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { PilotCutoverStage } from "@/lib/denis/config/pilot-cutover-ladder";

export type PilotReadiness = {
  ready: boolean;
  blockers: string[];
};

export async function checkPilotReadiness(
  _admin: SupabaseClient,
  _locationId: string,
  input: {
    config: ConciergeConfig;
    pilotCutover: PilotCutoverStage | null;
    deps: {
      evalPassRatePct: number;
      actOrderErrors7d: number;
      completedSessions: number;
      staffCopilotAcknowledged: boolean;
    };
  }
): Promise<PilotReadiness> {
  const blockers: string[] = [];
  if (!input.config.proactive.staffAllergy) {
    blockers.push("Allergy staff alerts must be enabled.");
  }
  if (!input.config.ops.floorGraphEnabled) {
    blockers.push("Floor graph must be enabled.");
  }
  if (input.deps.evalPassRatePct < 95) {
    blockers.push("Eval pass rate below 95%.");
  }
  if (input.deps.actOrderErrors7d > 0) {
    blockers.push("ACT order errors in last 7 days.");
  }
  if (input.deps.completedSessions < 20) {
    blockers.push("Not enough completed sessions.");
  }
  if (!input.deps.staffCopilotAcknowledged) {
    blockers.push("Staff copilot checklist not acknowledged.");
  }
  return { ready: blockers.length === 0, blockers };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { detectAbuseSignals } from "@/lib/denis/security/abuse-protection";
import { isInCanaryCohort } from "@/lib/denis/config/rollout";
import {
  loadGuestConductTracker,
  saveGuestConductTracker,
} from "@/lib/denis/cognition/policy/guest-conduct-tracker-store";
import { resolveGuestConductPolicy } from "@/lib/denis/cognition/policy/resolve-guest-conduct-policy";
import { appendDenisTimelineEvent } from "@/lib/denis/platform/append-timeline-event";

/**
 * MVP-1/2 (Architecture Proposal §16 steps 1-2) — pure logging side effect,
 * never touches the guest-visible response. Gated behind
 * config.ops.guestConduct so it costs nothing when disabled (the default).
 * Only reacts to abuse-protection.ts's `offensive_content` signal — never
 * rate_exceeded/prompt_injection/etc (security concerns already owned
 * elsewhere) and never service frustration (frustration-recovery.ts's
 * territory) — per the founder's own explicit scope decision.
 */
export async function runGuestConductShadowCheck(
  admin: SupabaseClient,
  input: {
    aiSessionId: string | null;
    message: string;
    guestConductConfig: { enabled: boolean; shadowOnly: boolean; canaryPercent: number };
    traceId?: string;
  }
): Promise<void> {
  if (!input.guestConductConfig.enabled) return;
  if (!input.aiSessionId) return;
  if (!isInCanaryCohort(input.aiSessionId, input.guestConductConfig.canaryPercent)) return;

  const offenseDetectedThisTurn = detectAbuseSignals(input.message).includes(
    "offensive_content"
  );

  const tracker = await loadGuestConductTracker(input.aiSessionId);
  const { decision, tracker: nextTracker } = resolveGuestConductPolicy({
    offenseDetectedThisTurn,
    tracker,
  });
  await saveGuestConductTracker(nextTracker);

  await appendDenisTimelineEvent(admin, {
    aiSessionId: input.aiSessionId,
    eventType: "conduct.policy_decision",
    traceId: input.traceId,
    payload: {
      type: "conduct.policy_decision",
      tier: decision.tier,
      offenseDetectedThisTurn,
      totalOffenseCount: nextTracker.totalOffenseCount,
      haltSensitiveActions: decision.haltSensitiveActions,
      notifyStaff: decision.notifyStaff,
      reason: decision.auditReason,
      shadowOnly: input.guestConductConfig.shadowOnly,
    },
  });
}

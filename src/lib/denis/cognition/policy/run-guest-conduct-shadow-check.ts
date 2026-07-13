import type { SupabaseClient } from "@supabase/supabase-js";
import { detectAbuseSignals } from "@/lib/denis/security/abuse-protection";
import { isInCanaryCohort } from "@/lib/denis/config/rollout";
import { assessGuestConduct } from "@/lib/denis/cognition/perceive/assess-guest-conduct";
import {
  loadGuestConductTracker,
  saveGuestConductTracker,
} from "@/lib/denis/cognition/policy/guest-conduct-tracker-store";
import { resolveGuestConductPolicy } from "@/lib/denis/cognition/policy/resolve-guest-conduct-policy";
import { appendDenisTimelineEvent } from "@/lib/denis/platform/append-timeline-event";
import { createMission } from "@/lib/denis/missions/create-mission";
import { dispatchStaffNotification } from "@/lib/denis/notifications/dispatch-staff-notification";

/**
 * MVP-1/2/3 (Architecture Proposal §16 steps 1-3) — pure logging side
 * effect, never touches the guest-visible response. Gated behind
 * config.ops.guestConduct so it costs nothing when disabled (the default).
 *
 * The founder's explicit call: Denis is a genuinely smart AI — tone
 * assessment should come from real understanding (assessGuestConduct),
 * called on every turn, not a raw keyword/regex filter. abuse-protection.ts's
 * regex `offensive_content` is kept ONLY as an outage fallback — it's
 * consulted exclusively when the LLM assessment comes back null (OpenAI
 * down, call error, malformed output). When the LLM succeeds, its
 * judgment is the sole authority; regex is never combined with it.
 * Both are still logged (regexOnlyOffenseDetected vs the combined
 * offenseDetectedThisTurn, plus the raw llmAssessment) so a shadow-mode
 * review can see exactly when the fallback had to carry the turn.
 *
 * Never reacts to rate_exceeded/prompt_injection/etc (security concerns
 * already owned elsewhere) and never to service frustration
 * (frustration-recovery.ts's territory) — per the founder's own explicit
 * scope decision: this ladder is only for rudeness directed at Denis.
 *
 * MVP-4 (Architecture Proposal §16 step 4) — a handoff-tier decision now
 * creates a real denis_missions row + staff notification, but ONLY when
 * `guestConductConfig.shadowOnly` is false. While shadowOnly (today's
 * default), this only ever LOGS `wouldCreateMission` — the ladder itself
 * hasn't been cleared for live guest impact yet (step 5), and a staff
 * mission/notification is exactly the kind of real-world side effect that
 * shadow mode exists to hold back. createMission's own idempotency guard
 * (one open mission per ai_session_id+kind) makes it safe to call this
 * every turn the tier stays at "handoff", not just on the transition turn.
 */
const MIN_CONFIDENCE_TO_ACT = 0.55;

async function maybeCreateHandoffMission(
  admin: SupabaseClient,
  input: {
    aiSessionId: string;
    orgId: string | null;
    locationId: string | null;
    tableId: string | null;
    tier: string;
    shadowOnly: boolean;
    traceId?: string;
  }
): Promise<{ wouldCreateMission: boolean; missionId: string | null }> {
  if (input.tier !== "handoff") return { wouldCreateMission: false, missionId: null };
  if (!input.orgId || !input.locationId) {
    return { wouldCreateMission: true, missionId: null };
  }
  if (input.shadowOnly) {
    return { wouldCreateMission: true, missionId: null };
  }

  const result = await createMission(admin, {
    kind: "guest_conduct_handoff",
    orgId: input.orgId,
    locationId: input.locationId,
    tableId: input.tableId,
    aiSessionId: input.aiSessionId,
    priority: "urgent",
    title: "Guest conduct handoff",
    summary:
      "Denis's guest-conduct ladder reached handoff — a colleague should take over this conversation.",
  });

  if (!result.created) {
    return { wouldCreateMission: true, missionId: null };
  }

  await dispatchStaffNotification({
    orgId: input.orgId,
    locationId: input.locationId,
    type: "denis_escalation",
    priorityOverride: "urgent",
    tableId: input.tableId ?? undefined,
    message: "Denis need pomoć — gost je bio uporno neljubazan, preuzmite razgovor.",
    actionUrl: input.tableId ? `/waiter/tables/${input.tableId}` : "/dashboard/denis",
  }).catch(() => undefined);

  return { wouldCreateMission: true, missionId: result.mission.id };
}

export async function runGuestConductShadowCheck(
  admin: SupabaseClient,
  input: {
    aiSessionId: string | null;
    message: string;
    recentTranscript?: string[];
    guestConductConfig: { enabled: boolean; shadowOnly: boolean; canaryPercent: number };
    orgId?: string | null;
    locationId?: string | null;
    tableId?: string | null;
    traceId?: string;
  }
): Promise<void> {
  if (!input.guestConductConfig.enabled) return;
  if (!input.aiSessionId) return;
  if (!isInCanaryCohort(input.aiSessionId, input.guestConductConfig.canaryPercent)) return;

  const [regexOnlyOffenseDetected, llmAssessment] = await Promise.all([
    Promise.resolve(
      detectAbuseSignals(input.message).includes("offensive_content")
    ),
    assessGuestConduct({
      message: input.message,
      recentTranscript: input.recentTranscript,
    }),
  ]);

  const llmSaysOffense =
    llmAssessment != null &&
    llmAssessment.directedAt === "denis" &&
    llmAssessment.confidence >= MIN_CONFIDENCE_TO_ACT &&
    (llmAssessment.toneTowardDenis === "mild_insult" ||
      llmAssessment.toneTowardDenis === "severe_insult" ||
      llmAssessment.toneTowardDenis === "threat");

  // LLM judgment is authoritative when available — regex only carries the
  // turn if the LLM genuinely couldn't be consulted.
  const offenseDetectedThisTurn =
    llmAssessment != null ? llmSaysOffense : regexOnlyOffenseDetected;

  const tracker = await loadGuestConductTracker(input.aiSessionId);
  const { decision, tracker: nextTracker } = resolveGuestConductPolicy({
    offenseDetectedThisTurn,
    tracker,
  });
  await saveGuestConductTracker(nextTracker);

  const missionOutcome = await maybeCreateHandoffMission(admin, {
    aiSessionId: input.aiSessionId,
    orgId: input.orgId ?? null,
    locationId: input.locationId ?? null,
    tableId: input.tableId ?? null,
    tier: decision.tier,
    shadowOnly: input.guestConductConfig.shadowOnly,
    traceId: input.traceId,
  });

  await appendDenisTimelineEvent(admin, {
    aiSessionId: input.aiSessionId,
    eventType: "conduct.policy_decision",
    traceId: input.traceId,
    payload: {
      type: "conduct.policy_decision",
      tier: decision.tier,
      offenseDetectedThisTurn,
      regexOnlyOffenseDetected,
      llmAssessment,
      totalOffenseCount: nextTracker.totalOffenseCount,
      haltSensitiveActions: decision.haltSensitiveActions,
      notifyStaff: decision.notifyStaff,
      reason: decision.auditReason,
      shadowOnly: input.guestConductConfig.shadowOnly,
      wouldCreateMission: missionOutcome.wouldCreateMission,
      missionId: missionOutcome.missionId,
    },
  });
}

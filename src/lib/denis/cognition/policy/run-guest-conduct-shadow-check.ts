import type { SupabaseClient } from "@supabase/supabase-js";
import { detectAbuseSignals } from "@/lib/denis/security/abuse-protection";
import { isInCanaryCohort } from "@/lib/denis/config/rollout";
import { assessGuestConduct } from "@/lib/denis/cognition/policy/assess-guest-conduct";
import {
  loadGuestConductTracker,
  saveGuestConductTracker,
} from "@/lib/denis/cognition/policy/guest-conduct-tracker-store";
import { resolveGuestConductPolicy } from "@/lib/denis/cognition/policy/resolve-guest-conduct-policy";
import { appendDenisTimelineEvent } from "@/lib/denis/platform/append-timeline-event";

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
 */
const MIN_CONFIDENCE_TO_ACT = 0.55;

export async function runGuestConductShadowCheck(
  admin: SupabaseClient,
  input: {
    aiSessionId: string | null;
    message: string;
    recentTranscript?: string[];
    guestConductConfig: { enabled: boolean; shadowOnly: boolean; canaryPercent: number };
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
    },
  });
}

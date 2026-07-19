import { shieldGracefulGuestMessage } from "@/lib/ai/moderation";
import {
  buildSecurityBlockedPayload,
  logShieldBlock,
  recordShieldBlock,
  screenOutput,
} from "@/lib/ai/prompt-shield";
import type { GuestConductCheckOutcome } from "@/lib/denis/cognition/policy/run-guest-conduct-shadow-check";
import {
  kernelTimelineEnabled,
  type ConciergeRolloutMode,
} from "@/lib/denis/config/rollout";
import { dispatchStaffNotification } from "@/lib/denis/notifications/dispatch-staff-notification";
import { appendDenisTimelineEvent } from "@/lib/denis/platform/append-timeline-event";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export type ApplyOutputSafetyInput = {
  guestMessage: string | null;
  admin: ReturnType<typeof createAdminClient>;
  traceId: string;
  timelineAiSessionId: string | null;
  sessionId: string | undefined;
  locationId: string;
  tableId: string;
  orgId: string;
  rolloutMode: ConciergeRolloutMode;
  conductOutcome: GuestConductCheckOutcome | null | undefined;
};

/**
 * Applies the two output-safety transforms Denis's outgoing guest message
 * must go through, in a fixed order that this function structurally
 * guarantees rather than leaving to caller ordering:
 *
 * 1. Output shield — screens the drafted reply for leaked system/prompt
 *    content; on a hit it logs + records the block, optionally writes a
 *    timeline event and pages staff, then swaps in the graceful fallback
 *    message.
 * 2. Guest-conduct warn_1 override — MVP-5: prepends the deterministic
 *    polite reminder when armed. This MUST run after the shield so the
 *    shield can never strip the conduct reminder back out.
 */
export async function applyOutputSafety(
  input: ApplyOutputSafetyInput
): Promise<{ guestMessage: string }> {
  const {
    admin,
    traceId,
    timelineAiSessionId,
    sessionId,
    locationId,
    tableId,
    orgId,
    rolloutMode,
    conductOutcome,
  } = input;

  let guestMessage = input.guestMessage;

  // 1. Output shield — must run first.
  const outputShield = screenOutput(guestMessage ?? "");
  if (!outputShield.safe) {
    logShieldBlock(
      outputShield.layer,
      outputShield.reason ?? "output_leak",
      guestMessage ?? "",
      "output"
    );
    const shieldSessionId = timelineAiSessionId ?? sessionId;
    const shieldState = await recordShieldBlock(shieldSessionId ?? "");
    if (timelineAiSessionId && kernelTimelineEnabled(rolloutMode)) {
      await appendDenisTimelineEvent(admin, {
        aiSessionId: timelineAiSessionId,
        eventType: "security.blocked",
        traceId,
        payload: buildSecurityBlockedPayload({
          direction: "output",
          reason: outputShield.reason ?? "output_leak",
          layer: outputShield.layer,
          preview: guestMessage ?? "",
          blockCount: shieldState.blockCount,
          sessionFlagged: shieldState.flagged,
          traceId,
        }),
      });
    }
    if (shieldState.notifyStaff) {
      void dispatchStaffNotification({
        orgId,
        locationId,
        type: "denis_escalation",
        message: `Denis output shield: ${shieldState.blockCount} blocked attempts at this table — session flagged.`,
        tableId,
        priorityOverride: "high",
        playSound: true,
      }).catch((error) => {
        logger.warn("Prompt shield staff alert failed", {
          sessionId: shieldSessionId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
    guestMessage = shieldGracefulGuestMessage();
  }

  // 2. MVP-5 — guest-conduct warn_1 goes live: prepend the deterministic
  // polite reminder to the reply (service continues, the boundary is
  // stated). Armed only when shadowOnly is off AND the tier is warn_1 —
  // warn_2/handoff overrides stay shadow-held until their own flip.
  // Applied after the output shield so the shield never rewrites it away.
  if (conductOutcome?.overrideArmed && conductOutcome.decision.guestMessageOverride) {
    guestMessage = [conductOutcome.decision.guestMessageOverride, guestMessage ?? ""]
      .join(" ")
      .trim();
  }

  return { guestMessage: guestMessage ?? "" };
}

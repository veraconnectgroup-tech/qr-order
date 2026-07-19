import { apiError, apiSuccess } from "@/lib/api-response";
import { moderateGuestInput, shieldGracefulGuestMessage } from "@/lib/ai/moderation";
import {
  buildSecurityBlockedPayload,
  logShieldBlock,
  recordShieldBlock,
} from "@/lib/ai/prompt-shield";
import {
  assertSufficientCredits,
  resolveAiTurnOrg,
} from "@/lib/denis/commercial";
import { appendDenisTimelineEvent } from "@/lib/denis/platform/append-timeline-event";
import { createTurnTraceId } from "@/lib/denis/platform/timeline-types";
import { dispatchStaffNotification } from "@/lib/denis/notifications/dispatch-staff-notification";
import type { DenisChatBody, DenisTurnRunInput } from "@/lib/denis/runtime/turn-types";
import { emptyTurnTimings } from "@/lib/denis/runtime/turn-observability";
import { parseDenisChatBody } from "@/lib/denis/surfaces/chat/parse-chat-request";
import { parseDenisVoiceBody } from "@/lib/denis/surfaces/voice/parse-voice-turn";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

function isSupportedTurnChannel(
  channel: DenisTurnRunInput["channel"]
): channel is "chat" | "voice" {
  return channel === "chat" || channel === "voice";
}

async function handleInputShieldBlock(input: {
  admin: ReturnType<typeof createAdminClient>;
  message: string;
  reason: string;
  sessionId: string;
  locationId: string;
  tableId: string;
  orgId: string;
  traceId: string;
}): Promise<Response> {
  const shieldState = await recordShieldBlock(input.sessionId);
  logShieldBlock("regex", input.reason, input.message, "input");

  await appendDenisTimelineEvent(input.admin, {
    aiSessionId: input.sessionId,
    eventType: "security.blocked",
    traceId: input.traceId,
    payload: buildSecurityBlockedPayload({
      direction: "input",
      reason: input.reason,
      layer: "regex",
      preview: input.message,
      blockCount: shieldState.blockCount,
      sessionFlagged: shieldState.flagged,
      traceId: input.traceId,
    }),
  });

  if (shieldState.notifyStaff) {
    void dispatchStaffNotification({
      orgId: input.orgId,
      locationId: input.locationId,
      type: "denis_escalation",
      message: `Denis prompt shield: ${shieldState.blockCount} blocked attempts at this table — session flagged.`,
      tableId: input.tableId,
      priorityOverride: "high",
      playSound: true,
    }).catch((error) => {
      logger.warn("Prompt shield staff alert failed", {
        sessionId: input.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  return apiSuccess({
    message: shieldGracefulGuestMessage(),
    recommendations: [],
    cartActions: [],
    quickReplies: [],
    intent: "chat",
    submitOrder: false,
    sessionId: input.sessionId,
  });
}

export type TurnPreconditionsResult =
  | { ok: false; response: Response }
  | {
      ok: true;
      admin: ReturnType<typeof createAdminClient>;
      traceId: string;
      timings: ReturnType<typeof emptyTurnTimings>;
      parsed: DenisChatBody;
      orgId: string;
      creditBalanceAfter: number;
      channel: "chat" | "voice";
    };

/**
 * Validates channel support, request body shape, org resolution, credit balance,
 * and guest-input safety before the main PPAN+ turn loop runs.
 */
export async function validateTurnPreconditions(
  input: DenisTurnRunInput
): Promise<TurnPreconditionsResult> {
  if (!isSupportedTurnChannel(input.channel)) {
    return { ok: false, response: apiError("Unsupported channel.", 400) };
  }
  const channel = input.channel;

  const parsed =
    channel === "voice"
      ? parseDenisVoiceBody(input.rawBody)
      : parseDenisChatBody(input.rawBody);
  if (!parsed.ok) {
    return { ok: false, response: parsed.response };
  }

  const admin = createAdminClient();
  const traceId = createTurnTraceId();
  const timings = emptyTurnTimings();

  const orgResult = await resolveAiTurnOrg(admin, {
    locationId: parsed.data.locationId,
    tableId: parsed.data.tableId,
    sessionToken: parsed.data.sessionToken,
  });
  if (!orgResult.ok) {
    return { ok: false, response: apiError(orgResult.error, orgResult.status) };
  }

  const creditCheck = await assertSufficientCredits(admin, orgResult.data.orgId);
  if (!creditCheck.ok) {
    return { ok: false, response: apiError("insufficient_credits", 402) };
  }

  const inputModeration = moderateGuestInput(parsed.data.message);
  if (!inputModeration.safe) {
    const response = await handleInputShieldBlock({
      admin,
      message: parsed.data.message,
      reason: inputModeration.reason,
      sessionId: parsed.data.sessionId ?? "",
      locationId: parsed.data.locationId,
      tableId: parsed.data.tableId,
      orgId: orgResult.data.orgId,
      traceId,
    });
    return { ok: false, response };
  }

  return {
    ok: true,
    admin,
    traceId,
    timings,
    parsed: parsed.data,
    orgId: orgResult.data.orgId,
    creditBalanceAfter: creditCheck.balanceAfter,
    channel,
  };
}

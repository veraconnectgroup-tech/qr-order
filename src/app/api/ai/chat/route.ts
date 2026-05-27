import { handleAiChat } from "@/lib/ai/chat-service";
import { recordChatTurnTimeline } from "@/lib/denis/runtime/record-chat-turn-timeline";
import type { GuestIntent } from "@/lib/denis/platform/timeline-types";
import { apiError } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { zSessionToken } from "@/lib/security/zod-fields";
import { withRateLimitByKey } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

type ChatSuccessData = {
  sessionId?: string;
  message?: string;
  intent?: string;
};

export const POST = withErrorHandler("ai-chat-post", async (req, _ctx) => {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return apiError("Invalid input.", 400);
  }

  const sessionTokenParsed = zSessionToken().safeParse(
    (body as { sessionToken?: string }).sessionToken ?? ""
  );
  if (!sessionTokenParsed.success) {
    return apiError("Invalid input.", 400);
  }

  const limited = await withRateLimitByKey("ai", sessionTokenParsed.data);
  if (limited) return limited;

  const response = await handleAiChat(body);
  if (response.status !== 200) {
    return response;
  }

  const payload = (await response.clone().json()) as {
    data?: ChatSuccessData;
  };
  const data = payload.data;
  const guestMessage =
    typeof (body as { message?: string }).message === "string"
      ? (body as { message: string }).message
      : "";

  if (data?.sessionId && data.message && guestMessage) {
    void recordChatTurnTimeline(createAdminClient(), {
      aiSessionId: data.sessionId,
      locationId:
        typeof (body as { locationId?: string }).locationId === "string"
          ? (body as { locationId: string }).locationId
          : undefined,
      guestMessage,
      assistantMessage: data.message,
      intent: (data.intent ?? "UNKNOWN") as GuestIntent,
    });
  }

  return response;
});

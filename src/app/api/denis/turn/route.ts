import { withErrorHandler } from "@/lib/api/with-error-handler";
import { inferDenisChannelFromBody } from "@/lib/denis/surfaces/voice/infer-denis-channel";
import { runDenisTurn } from "@/lib/denis/runtime/run-denis-turn";
import { zSessionToken } from "@/lib/security/zod-fields";
import { withRateLimitByKey } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-response";

export const POST = withErrorHandler("denis-turn-post", async (req, _ctx) => {
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

  return runDenisTurn({
    channel: inferDenisChannelFromBody(body),
    rawBody: body,
  });
});

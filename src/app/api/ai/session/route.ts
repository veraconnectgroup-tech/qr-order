import { loadAiSessionHistory } from "@/lib/ai/load-ai-session-messages";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { withRateLimitByKey } from "@/lib/rate-limit";
import { zSessionToken, zUuid } from "@/lib/security/zod-fields";

export const GET = withErrorHandler("ai-session-get", async (req, _ctx) => {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId") ?? "";
  const locationId = url.searchParams.get("locationId") ?? "";
  const tableId = url.searchParams.get("tableId") ?? "";
  const sessionToken = url.searchParams.get("sessionToken") ?? "";

  const sessionTokenParsed = zSessionToken().safeParse(sessionToken);
  if (!sessionTokenParsed.success) {
    return apiError("Invalid input.", 400);
  }

  const limited = await withRateLimitByKey("ai", sessionTokenParsed.data);
  if (limited) return limited;

  const sessionIdParsed = zUuid().safeParse(sessionId);
  const locationIdParsed = zUuid().safeParse(locationId);
  const tableIdParsed = zUuid().safeParse(tableId);

  if (
    !sessionIdParsed.success ||
    !locationIdParsed.success ||
    !tableIdParsed.success
  ) {
    return apiError("Invalid input.", 400);
  }

  const result = await loadAiSessionHistory({
    sessionId: sessionIdParsed.data,
    locationId: locationIdParsed.data,
    tableId: tableIdParsed.data,
    sessionToken: sessionTokenParsed.data,
  });

  if ("error" in result) {
    return apiError(result.error, result.status);
  }

  return apiSuccess(result.data);
});

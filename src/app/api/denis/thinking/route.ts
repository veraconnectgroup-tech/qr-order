import { withErrorHandler } from "@/lib/api/with-error-handler";
import { apiError } from "@/lib/api-response";
import { runDenisThinkingPreview } from "@/lib/denis/runtime/run-denis-thinking-preview";
import { checkRateLimit, getClientIp, withRateLimitByKey } from "@/lib/rate-limit";
import { zSessionToken, zTableToken } from "@/lib/security/zod-fields";

/** Fast TDE turn-plan preview for guest thinking UI (no LLM). */
export const POST = withErrorHandler("denis-thinking-post", async (req, _ctx) => {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return apiError("Invalid input.", 400);
  }

  const tableToken = (body as { tableToken?: string }).tableToken;
  const sessionToken =
    (body as { tableSessionToken?: string }).tableSessionToken ??
    (body as { sessionToken?: string }).sessionToken;

  const rateKey =
    typeof sessionToken === "string"
      ? sessionToken
      : typeof tableToken === "string"
        ? tableToken
        : null;

  if (rateKey) {
    const sessionParsed = zSessionToken().safeParse(rateKey);
    if (sessionParsed.success) {
      const limited = await withRateLimitByKey("ai", sessionParsed.data);
      if (limited) return limited;
    }
  }

  if (typeof tableToken === "string") {
    const tableParsed = zTableToken().safeParse(tableToken);
    if (tableParsed.success) {
      const ip = getClientIp(req);
      const tableKey = `waiter:table:${tableParsed.data}`;
      const ipKey = `waiter:ip:${ip}`;
      if (!checkRateLimit(tableKey, 120, 60 * 60 * 1000)) {
        return apiError("Too many requests from this table", 429);
      }
      if (!checkRateLimit(ipKey, 80, 60 * 60 * 1000)) {
        return apiError("Too many requests", 429);
      }
    }
  }

  return runDenisThinkingPreview(body);
});

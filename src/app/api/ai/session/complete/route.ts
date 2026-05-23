import { handleAiSessionComplete } from "@/lib/ai/conversion-service";
import { apiError } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { withRateLimitByKey } from "@/lib/rate-limit";
import { zSessionToken } from "@/lib/security/zod-fields";

export const POST = withErrorHandler(
  "ai-session-complete-post",
  async (req, _ctx) => {
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

    const limited = await withRateLimitByKey(
      "ai",
      sessionTokenParsed.data
    );
    if (limited) return limited;

    return await handleAiSessionComplete(body);
  }
);

import { withErrorHandler } from "@/lib/api/with-error-handler";
import { apiError } from "@/lib/api-response";
import { denisSenseRequestSchema } from "@/lib/denis/platform/sense-types";
import { runDenisSense } from "@/lib/denis/runtime/run-denis-sense";
import { withRateLimitByKey } from "@/lib/rate-limit";
import { zSessionToken } from "@/lib/security/zod-fields";

export const POST = withErrorHandler("denis-sense-post", async (req, _ctx) => {
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

  const parsed = denisSenseRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid input.", 400);
  }

  return runDenisSense(parsed.data);
});

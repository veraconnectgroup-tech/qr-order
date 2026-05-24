import { handleAiOrderSubmit } from "@/lib/ai/ordering/submit-service";
import { apiError } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { withRateLimitByKey } from "@/lib/rate-limit";
import { zSessionToken, zTableToken, zUuid } from "@/lib/security/zod-fields";
import { z } from "zod";

const submitSchema = z.object({
  sessionId: zUuid(),
  locationId: zUuid(),
  tableId: zUuid(),
  tableToken: zTableToken(),
  sessionToken: zSessionToken().optional(),
  deviceFingerprint: z.string().min(8).max(128),
  deviceToken: z.string().min(16).max(256).optional(),
});

export const POST = withErrorHandler("ai-order-submit-post", async (req, _ctx) => {
  const body = await req.json().catch(() => null);
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid input.", 400);
  }

  const limited = await withRateLimitByKey(
    "ai",
    parsed.data.sessionToken ?? parsed.data.tableToken
  );
  if (limited) return limited;

  return handleAiOrderSubmit(parsed.data);
});

import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { noCache } from "@/lib/cache/headers";
import { logger } from "@/lib/logger";
import { notifyLocationPush } from "@/lib/push/notify-location";
import { isPushConfigured } from "@/lib/push/vapid";

const notifySchema = z.object({
  locationId: z.string().uuid(),
  type: z.enum(["new-order", "waiter-call", "order-ready", "payment-request"]).optional(),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(500),
  url: z.string().max(2048).optional(),
});

export const POST = withErrorHandler("push-notify-post", async (req, _ctx) => {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return apiError("Unauthorized", 401, undefined, noCache());
  }

  if (!isPushConfigured()) {
    return apiError(
      "Push notifications are not configured.",
      503,
      undefined,
      noCache()
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = notifySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid input.", 400, parsed.error.flatten(), noCache());
  }

  const { locationId, type, title, body: messageBody, url } = parsed.data;

  const result = await notifyLocationPush(locationId, {
    title,
    body: messageBody,
    url,
  });

  logger.info("Push notifications sent", {
    locationId,
    type,
    ...result,
  });

  return apiSuccess(result, 200, noCache());
});

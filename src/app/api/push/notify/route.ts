import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { noCache } from "@/lib/cache/headers";
import { logger } from "@/lib/logger";
import { notifyLocationPush } from "@/lib/push/notify-location";
import { isPushConfigured } from "@/lib/push/vapid";

const notifySchema = z.object({
  locationId: z.string().uuid(),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(500),
  url: z.string().url().max(2048).optional(),
});

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return apiError("Unauthorized", 401, undefined, noCache());
  }

  if (!isPushConfigured()) {
    return apiError("Push notifications are not configured.", 503, undefined, noCache());
  }

  const body = await req.json().catch(() => null);
  const parsed = notifySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid input.", 400, parsed.error.flatten(), noCache());
  }

  const { locationId, title, body: messageBody, url } = parsed.data;

  try {
    const result = await notifyLocationPush(locationId, {
      title,
      body: messageBody,
      url,
    });

    logger.info("Push notifications sent", {
      locationId,
      ...result,
    });

    return apiSuccess(result, 200, noCache());
  } catch (error) {
    logger.error("Push notify failed", {
      locationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError("Push notify failed.", 500, undefined, noCache());
  }
}

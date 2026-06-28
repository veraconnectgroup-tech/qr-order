import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { noCache } from "@/lib/cache/headers";
import { logger } from "@/lib/logger";
import { notifyLocationPush } from "@/lib/push/notify-location";
import {
  formatGroupedPushMessage,
  resolvePushSoundProfile,
  resolvePushVibrate,
  shouldGroupPushType,
  type PushNotifyType,
} from "@/lib/push/push-intelligence";
import { isPushConfigured } from "@/lib/push/vapid";
import { withCronRateLimit } from "@/lib/api-guard";
import { getRedisClient } from "@/lib/redis/client";

const notifySchema = z.object({
  locationId: z.string().uuid(),
  type: z
    .enum([
      "new-order",
      "waiter-call",
      "order-ready",
      "payment-request",
      "staff-alert",
      "staff-allergy",
      "staff-urgent",
      "waitlist-ready",
    ])
    .optional(),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(500),
  url: z.string().max(2048).optional(),
  sound: z.boolean().optional(),
  urgent: z.boolean().optional(),
  assignedStaffId: z.string().uuid().nullable().optional(),
  broadcast: z.boolean().optional(),
  groupCount: z.number().int().min(1).max(99).optional(),
});

export const POST = withErrorHandler("push-notify-post", async (req, _ctx) => {
  const limited = await withCronRateLimit(req);
  if (limited) return limited;

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

  const {
    locationId,
    type,
    title,
    body: messageBody,
    url,
    sound,
    urgent,
    assignedStaffId,
    broadcast,
    groupCount,
  } = parsed.data;

  const pushType = (type ?? "staff-alert") as PushNotifyType;
  const playSound =
    sound ??
    (pushType === "waiter-call" ||
      pushType === "staff-alert" ||
      pushType === "staff-allergy" ||
      pushType === "staff-urgent" ||
      pushType === "new-order");

  const isUrgent =
    urgent ??
    (pushType === "staff-allergy" ||
      pushType === "staff-urgent" ||
      pushType === "waiter-call" ||
      pushType === "waitlist-ready");

  let finalTitle = title;
  let finalBody = messageBody;

  if (
    groupCount &&
    groupCount > 1 &&
    pushType &&
    shouldGroupPushType(pushType)
  ) {
    const grouped = formatGroupedPushMessage(pushType, groupCount, messageBody);
    finalTitle = grouped.title;
    finalBody = grouped.body;
  } else if (shouldGroupPushType(pushType)) {
    const redis = getRedisClient();
    if (redis) {
      const count = Number(
        (await redis.get(`push-group:${locationId}:${pushType}`)) ?? 1
      );
      if (count > 1) {
        const grouped = formatGroupedPushMessage(pushType, count, messageBody);
        finalTitle = grouped.title;
        finalBody = grouped.body;
      }
    }
  }

  const result = await notifyLocationPush(
    locationId,
    {
      title: finalTitle,
      body: finalBody,
      url,
      sound: playSound,
      urgent: isUrgent,
      type: pushType,
      soundProfile: resolvePushSoundProfile(pushType),
      vibrate: resolvePushVibrate(pushType),
    },
    {
      assignedStaffId,
      broadcast: broadcast ?? isUrgent,
    }
  );

  logger.info("Push notifications sent", {
    locationId,
    type: pushType,
    sound: playSound,
    urgent: isUrgent,
    ...result,
  });

  return apiSuccess(result, 200, noCache());
});

import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import {
  buildRecordGoogleReviewClickPayload,
  recordGoogleReviewClickIdempotencyKey,
} from "@/lib/commerce/capabilities/reviews/record-google-review-click";
import { runCommerceExperience } from "@/lib/commerce/runtime/run-commerce-experience";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { persistReviewPromptMemory } from "@/lib/denis/learning/guest-memory/persist-review-prompt-memory";
import { verifyOrderSessionAccess } from "@/lib/orders/validate-table-session";
import { getCurrentTraceId } from "@/lib/resilience/trace.server";
import { withRateLimit } from "@/lib/rate-limit";
import { zSessionToken, zUuid } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  orderId: zUuid(),
  sessionToken: zSessionToken(),
  googleReviewUrl: z.string().url(),
  deviceFingerprint: z.string().min(8).max(128).optional(),
  triggerMoment: z.string().max(64).optional().nullable(),
});

export const POST = withErrorHandler("commerce-review-click-post", async (req) => {
  const limited = await withRateLimit(req, "default");
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return apiError("Invalid input.", 400);
  }

  const admin = createAdminClient();
  const allowed = await verifyOrderSessionAccess(
    admin,
    parsed.data.orderId,
    parsed.data.sessionToken
  );
  if (!allowed) {
    return apiError("Unauthorized.", 401);
  }

  const { data: order } = await admin
    .from("orders")
    .select("id, session_id, location_id")
    .eq("id", parsed.data.orderId)
    .maybeSingle();

  if (!order) {
    return apiError("Order not found.", 404);
  }

  const orderRow = order as {
    id: string;
    session_id: string | null;
    location_id: string;
  };

  if (!orderRow.session_id) {
    return apiError("Invalid session.", 400);
  }

  const payload = buildRecordGoogleReviewClickPayload({
    orderId: orderRow.id,
    googleReviewUrl: parsed.data.googleReviewUrl,
    triggerMoment: parsed.data.triggerMoment ?? null,
  });

  const commerce = await runCommerceExperience(
    admin,
    {
      kind: "guest_command",
      sessionId: orderRow.session_id,
      command: {
        type: "RecordGoogleReviewClick",
        payload,
      },
      idempotencyKey: recordGoogleReviewClickIdempotencyKey(orderRow.id),
    },
    {
      traceId: getCurrentTraceId(),
    }
  );

  if (parsed.data.deviceFingerprint?.trim()) {
    const config = await loadConciergeConfigForLocation(orderRow.location_id);
    await persistReviewPromptMemory(admin, {
      locationId: orderRow.location_id,
      deviceFingerprint: parsed.data.deviceFingerprint.trim(),
      action: "clicked",
      ttlDays: config.memory.memoryTtlDays,
    });
  }

  return apiSuccess({
    eventId: commerce.eventId,
  });
});

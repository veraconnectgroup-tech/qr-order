import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { persistReviewPromptMemory } from "@/lib/denis/learning/guest-memory/persist-review-prompt-memory";
import { verifyOrderSessionAccess } from "@/lib/orders/validate-table-session";
import { withRateLimit } from "@/lib/rate-limit";
import { zSessionToken, zUuid } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  orderId: zUuid(),
  sessionToken: zSessionToken(),
  action: z.enum(["prompt_shown", "dismissed"]),
  deviceFingerprint: z.string().min(8).max(128),
  triggerMoment: z.string().max(64).optional().nullable(),
  experienceScore: z.number().min(0).max(10).optional().nullable(),
});

export const POST = withErrorHandler("commerce-review-prompt-post", async (req) => {
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
    .select("location_id")
    .eq("id", parsed.data.orderId)
    .maybeSingle();

  if (!order) {
    return apiError("Order not found.", 404);
  }

  const locationId = (order as { location_id: string }).location_id;
  const config = await loadConciergeConfigForLocation(locationId);

  await persistReviewPromptMemory(admin, {
    locationId,
    deviceFingerprint: parsed.data.deviceFingerprint.trim(),
    action: parsed.data.action,
    ttlDays: config.memory.memoryTtlDays,
    triggerMoment: parsed.data.triggerMoment ?? null,
    experienceScore: parsed.data.experienceScore ?? null,
  });

  return apiSuccess({ ok: true });
});

import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { verifyAiGuestContext } from "@/lib/ai/verify-guest-context";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import {
  deleteGuestMemory,
  loadGuestMemoryProjection,
} from "@/lib/guest/denis-guest-memory-store";
import { withRateLimitByKey } from "@/lib/rate-limit";
import { zSessionToken, zUuid } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const memoryRequestSchema = z.object({
  locationId: zUuid(),
  tableId: zUuid(),
  sessionToken: zSessionToken(),
  deviceFingerprint: z.string().trim().min(8).max(128),
});

/** Load consented guest memory projection (M17). */
export const POST = withErrorHandler("guest-denis-memory-get", async (req) => {
  const body = await req.json().catch(() => null);
  const parsed = memoryRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid input.", 400);
  }

  const limited = await withRateLimitByKey("ai", parsed.data.sessionToken);
  if (limited) return limited;

  const admin = createAdminClient();
  const guestContext = await verifyAiGuestContext(admin, parsed.data);
  if ("error" in guestContext) {
    return apiError(guestContext.error, guestContext.status);
  }

  const config = await loadConciergeConfigForLocation(parsed.data.locationId);
  if (!config.enabled || !config.memory.returnGuestEnabled) {
    return apiError("Guest memory is not enabled.", 403);
  }

  const projection = await loadGuestMemoryProjection(admin, {
    locationId: parsed.data.locationId,
    deviceFingerprint: parsed.data.deviceFingerprint,
  });

  return apiSuccess(projection);
});

/** GDPR delete — revoke consent and erase stored memory. */
export const DELETE = withErrorHandler(
  "guest-denis-memory-delete",
  async (req) => {
    const body = await req.json().catch(() => null);
    const parsed = memoryRequestSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid input.", 400);
    }

    const limited = await withRateLimitByKey("ai", parsed.data.sessionToken);
    if (limited) return limited;

    const admin = createAdminClient();
    const guestContext = await verifyAiGuestContext(admin, parsed.data);
    if ("error" in guestContext) {
      return apiError(guestContext.error, guestContext.status);
    }

    const config = await loadConciergeConfigForLocation(parsed.data.locationId);
    if (!config.enabled || !config.memory.returnGuestEnabled) {
      return apiError("Guest memory is not enabled.", 403);
    }

    const ok = await deleteGuestMemory(admin, {
      locationId: parsed.data.locationId,
      deviceFingerprint: parsed.data.deviceFingerprint,
    });

    return apiSuccess({ deleted: ok });
  }
);

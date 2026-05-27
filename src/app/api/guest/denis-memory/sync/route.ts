import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { verifyAiGuestContext } from "@/lib/ai/verify-guest-context";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { syncGuestMemoryProfile } from "@/lib/guest/denis-guest-memory-store";
import { withRateLimitByKey } from "@/lib/rate-limit";
import { zSessionToken, zUuid } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";

const syncSchema = z.object({
  locationId: zUuid(),
  tableId: zUuid(),
  sessionToken: zSessionToken(),
  deviceFingerprint: z.string().trim().min(8).max(128),
  favoriteProductIds: z.array(zUuid()).max(20).optional(),
  lastVisitItemNames: z.array(z.string().trim().min(1).max(120)).max(8).optional(),
  allergyLabels: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  allergySheetIds: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  preferredLanguage: z.string().trim().min(2).max(10).nullable().optional(),
  recordVisit: z
    .object({
      itemNames: z.array(z.string().trim().min(1).max(120)).min(1).max(12),
    })
    .optional(),
});

/** Sync allergies, favorites, or record a completed visit (M17). */
export const POST = withErrorHandler("guest-denis-memory-sync", async (req) => {
  const body = await req.json().catch(() => null);
  const parsed = syncSchema.safeParse(body);
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

  const projection = await syncGuestMemoryProfile(admin, {
    locationId: parsed.data.locationId,
    deviceFingerprint: parsed.data.deviceFingerprint,
    ttlDays: config.memory.memoryTtlDays,
    sync: {
      favoriteProductIds: parsed.data.favoriteProductIds,
      lastVisitItemNames: parsed.data.lastVisitItemNames,
      allergyLabels: parsed.data.allergyLabels,
      allergySheetIds: parsed.data.allergySheetIds,
      preferredLanguage: parsed.data.preferredLanguage,
    },
    recordVisit: parsed.data.recordVisit,
  });

  if (!projection) {
    return apiError("No active consent.", 404);
  }

  return apiSuccess(projection);
});

import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { verifyAiGuestContext } from "@/lib/ai/verify-guest-context";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { grantGuestEngagementConsent } from "@/lib/denis/learning/guest-memory/persist-guest-engagement";
import { withRateLimitByKey } from "@/lib/rate-limit";
import { zSessionToken, zUuid } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  locationId: zUuid(),
  tableId: zUuid(),
  sessionToken: zSessionToken(),
  deviceFingerprint: z.string().trim().min(8).max(128),
});

/** Opt in to between-visit engagement messages (Q2 — GDPR). */
export const POST = withErrorHandler("guest-engagement-consent-post", async (req) => {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
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

  const { data: location } = await admin
    .from("locations")
    .select("org_id")
    .eq("id", parsed.data.locationId)
    .maybeSingle();

  const orgId = (location as { org_id: string } | null)?.org_id;
  if (!orgId) {
    return apiError("Location not found.", 404);
  }

  const config = await loadConciergeConfigForLocation(parsed.data.locationId);
  const ok = await grantGuestEngagementConsent(admin, {
    locationId: parsed.data.locationId,
    orgId,
    deviceFingerprint: parsed.data.deviceFingerprint,
    ttlDays: config.memory.memoryTtlDays,
  });

  if (!ok) {
    return apiError("Could not save consent.", 500);
  }

  return apiSuccess({ ok: true });
});

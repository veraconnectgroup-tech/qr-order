import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { verifyAiGuestContext } from "@/lib/ai/verify-guest-context";
import {
  loadGuestNotificationPreferences,
  upsertGuestNotificationPreferences,
} from "@/lib/notifications/guest-preferences";
import { withRateLimitByKey } from "@/lib/rate-limit";
import { zSessionToken, zUuid } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";

const channelSchema = z.enum(["push", "whatsapp", "sms", "email"]);

const bodySchema = z.object({
  locationId: zUuid(),
  tableId: zUuid(),
  sessionToken: zSessionToken(),
  deviceFingerprint: z.string().trim().min(8).max(128),
  phoneE164: z.string().trim().min(8).max(20).optional(),
  preferredChannel: channelSchema.optional(),
  smsConsent: z.boolean().optional(),
  whatsappConsent: z.boolean().optional(),
  transactionalConsent: z.boolean().optional(),
  marketingConsent: z.boolean().optional(),
});

/** Guest notification channel preferences — explicit opt-in per channel (Prompt 89). */
export const GET = withErrorHandler(
  "guest-notification-preferences-get",
  async (req) => {
    const locationId = req.nextUrl.searchParams.get("locationId");
    const deviceFingerprint = req.nextUrl.searchParams.get("deviceFingerprint");

    if (!locationId || !deviceFingerprint) {
      return apiError("locationId and deviceFingerprint required.", 400);
    }

    const admin = createAdminClient();
    const prefs = await loadGuestNotificationPreferences(admin, {
      locationId,
      deviceFingerprint,
    });

    return apiSuccess({ preferences: prefs });
  }
);

export const POST = withErrorHandler(
  "guest-notification-preferences-post",
  async (req) => {
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

    const prefs = await upsertGuestNotificationPreferences(admin, {
      locationId: parsed.data.locationId,
      deviceFingerprint: parsed.data.deviceFingerprint,
      phoneE164: parsed.data.phoneE164,
      preferredChannel: parsed.data.preferredChannel,
      smsConsent: parsed.data.smsConsent,
      whatsappConsent: parsed.data.whatsappConsent,
      transactionalConsent: parsed.data.transactionalConsent,
      marketingConsent: parsed.data.marketingConsent,
    });

    if (!prefs) {
      return apiError("Could not save preferences.", 500);
    }

    return apiSuccess({ preferences: prefs });
  }
);

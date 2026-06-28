import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import {
  loadActivePromoCodesForLocation,
  markPromoOfferedInSession,
  resolvePromoForGuest,
  wasPromoOfferedInSession,
} from "@/lib/denis/commerce";
import {
  calculateDiscountAmount,
  validatePromoCode,
  type PromoCodeRow,
} from "@/lib/promo/validate-promo";
import { withRateLimit } from "@/lib/rate-limit";
import { zSessionToken, zUuid } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  locationId: zUuid(),
  sessionToken: zSessionToken(),
  aiSessionId: z.string().trim().min(8).max(128).optional(),
  cartTotal: z.number().min(0),
  code: z.string().trim().min(1).max(50).optional(),
  visitCount: z.number().int().min(0).optional(),
  lastVisitAt: z.string().nullable().optional(),
  birthdayMonth: z.number().int().min(1).max(12).nullable().optional(),
  isRush: z.boolean().optional().default(false),
  markOffered: z.boolean().optional().default(false),
});

export const POST = withErrorHandler("commerce-apply-promo-post", async (req) => {
  const limited = await withRateLimit(req, "orders-guest");
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return apiError("Invalid input.", 400);
  }

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("table_sessions")
    .select("id, session_token, location_id")
    .eq("session_token", parsed.data.sessionToken)
    .eq("location_id", parsed.data.locationId)
    .maybeSingle();

  if (!session) {
    return apiError("Unauthorized.", 401);
  }

  const now = Date.now();
  const cartTotal = parsed.data.cartTotal;
  const activePromos = await loadActivePromoCodesForLocation(
    admin,
    parsed.data.locationId,
    { now, cartTotal }
  );

  const sessionKey = parsed.data.aiSessionId ?? parsed.data.sessionToken;
  const promoAlreadyOffered = await wasPromoOfferedInSession(sessionKey);

  if (parsed.data.code) {
    const promo = activePromos.find(
      (row) => row.code.toUpperCase() === parsed.data.code!.trim().toUpperCase()
    );
    const result = validatePromoCode(promo as PromoCodeRow | null, cartTotal);
    if (!result.valid) {
      return apiSuccess({
        eligible: false,
        error: result.error,
        minOrderAmount: result.minOrderAmount,
      });
    }

    if (parsed.data.markOffered) {
      await markPromoOfferedInSession(sessionKey, result.code);
    }

    return apiSuccess({
      eligible: true,
      code: result.code,
      promoCodeId: result.promoCodeId,
      discountType: result.discountType,
      discountValue: result.discountValue,
      discountAmount: result.discountAmount,
      applied: true,
    });
  }

  const resolution = resolvePromoForGuest({
    guestMemory: {
      visitCount: parsed.data.visitCount ?? 0,
      lastVisitAt: parsed.data.lastVisitAt ?? null,
      birthdayMonth: parsed.data.birthdayMonth ?? null,
    },
    activePromos,
    cartTotal,
    venueOccupancy: 0.5,
    rhythmPriors: { currentSlotStress: "normal", slotSampleSessions: 0 },
    now,
    promoAlreadyOffered,
    guestAskedAboutPromo: false,
    isRush: parsed.data.isRush,
    firstVisit: (parsed.data.visitCount ?? 0) <= 0,
  });

  if (!resolution) {
    return apiSuccess({ eligible: false, reason: "no_match" });
  }

  const promo = activePromos.find(
    (row) => row.code.toUpperCase() === resolution.code.toUpperCase()
  );
  const validated = validatePromoCode(promo as PromoCodeRow | null, cartTotal);

  if (parsed.data.markOffered && validated.valid) {
    await markPromoOfferedInSession(sessionKey, resolution.code);
  }

  return apiSuccess({
    eligible: true,
    code: resolution.code,
    reason: resolution.reason,
    message: resolution.message,
    discountDisplay: resolution.discountDisplay,
    promoCodeId: validated.valid ? validated.promoCodeId : null,
    discountAmount: validated.valid
      ? validated.discountAmount
      : promo
        ? calculateDiscountAmount(promo, cartTotal)
        : 0,
    applied: false,
  });
});

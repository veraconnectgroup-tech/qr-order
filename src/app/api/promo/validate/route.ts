
import { z } from "zod";
import { safeJsonParse } from "@/lib/api/safe-json";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { withRateLimit } from "@/lib/rate-limit";
import { zUuid } from "@/lib/security/zod-fields";
import { validatePromoCode, type PromoCodeRow } from "@/lib/promo/validate-promo";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  code: z.string().trim().min(1).max(50),
  locationId: zUuid(),
  orderAmount: z.number().min(0),
});

export const POST = withErrorHandler(
  "promo-validate-post",
  async (req, _ctx) => {
    const limited = await withRateLimit(req, "orders-guest");
    if (limited) return limited;

    const body = await safeJsonParse(req);
    if (!body) {
      return apiError("Invalid JSON.", 400);
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid input.", 400);
    }

    const { code, locationId, orderAmount } = parsed.data;
    const admin = createAdminClient();

    const { data: promo } = await admin
      .from("promo_codes")
      .select("*")
      .eq("location_id", locationId)
      .ilike("code", code)
      .maybeSingle();

    const result = validatePromoCode(
      promo as PromoCodeRow | null,
      orderAmount
    );

    if (!result.valid) {
      return apiSuccess({
        valid: false,
        error: result.error,
        minOrderAmount: result.minOrderAmount,
      });
    }

    return apiSuccess({
      valid: true,
      promoCodeId: result.promoCodeId,
      code: result.code,
      discountType: result.discountType,
      discountValue: result.discountValue,
      discountAmount: result.discountAmount,
    });
  }
);

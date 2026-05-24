import {
  err,
  ok,
  type OrderCreateError,
  type Result,
} from "@/lib/orders/create/result";
import { orderError } from "@/lib/orders/create/pipeline/errors";
import type { OrderPricing, ValidatedLineItem } from "@/lib/orders/create/types";
import {
  applyOrderDiscount,
  computeOrderTaxTotals,
} from "@/lib/orders/shared/compute-totals";
import { validateOrderTotal } from "@/lib/security/order-limits";
import {
  validatePromoCode,
  type PromoCodeRow,
  type PromoErrorCode,
} from "@/lib/promo/validate-promo";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

const PROMO_ERROR_MESSAGES: Record<PromoErrorCode, string> = {
  not_found: "Invalid promo code.",
  inactive: "This promo code is not active.",
  not_yet_valid: "This promo code is not valid yet.",
  expired: "This promo code has expired.",
  min_order: "Order total does not meet the minimum for this promo code.",
  max_uses: "This promo code has reached its usage limit.",
};

async function resolvePromoDiscount(
  admin: AdminClient,
  promoCodeId: string | undefined,
  locationId: string,
  preDiscountTotal: number
): Promise<Result<Pick<OrderPricing, "discountAmount" | "promoCodeId">, OrderCreateError>> {
  if (!promoCodeId) {
    return ok({ discountAmount: 0, promoCodeId: null });
  }

  const { data: promo } = await admin
    .from("promo_codes")
    .select("*")
    .eq("id", promoCodeId)
    .eq("location_id", locationId)
    .maybeSingle();

  const result = validatePromoCode(promo as PromoCodeRow | null, preDiscountTotal);
  if (!result.valid) {
    return err(
      orderError("promo_invalid", PROMO_ERROR_MESSAGES[result.error], 400)
    );
  }

  return ok({
    discountAmount: result.discountAmount,
    promoCodeId: result.promoCodeId,
  });
}

export async function computeOrderPricing(
  admin: AdminClient,
  input: {
    lineItems: ValidatedLineItem[];
    promoCodeId?: string;
    locationId: string;
    orgDefaultTaxPercent: number;
  }
): Promise<Result<OrderPricing, OrderCreateError>> {
  const { subtotal, taxAmount, effectiveTaxPercent, total } =
    computeOrderTaxTotals(input.lineItems, input.orgDefaultTaxPercent);

  const totalError = validateOrderTotal(total);
  if (totalError) {
    return err(orderError("invalid_input", totalError, 400));
  }

  const promoResult = await resolvePromoDiscount(
    admin,
    input.promoCodeId,
    input.locationId,
    total
  );

  if (!promoResult.ok) {
    return err(promoResult.error);
  }

  const { discountAmount, promoCodeId } = promoResult.value;

  return ok({
    subtotal,
    taxAmount,
    effectiveTaxPercent,
    discountAmount,
    finalTotal: applyOrderDiscount(total, discountAmount),
    promoCodeId,
  });
}

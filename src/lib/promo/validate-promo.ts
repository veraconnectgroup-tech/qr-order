export type PromoDiscountType = "percent" | "fixed";

export type PromoCodeRow = {
  id: string;
  location_id: string;
  code: string;
  discount_type: PromoDiscountType;
  discount_value: number;
  min_order_amount: number;
  max_uses: number | null;
  used_count: number;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
};

export type PromoErrorCode =
  | "not_found"
  | "inactive"
  | "not_yet_valid"
  | "expired"
  | "min_order"
  | "max_uses";

export type PromoValidationSuccess = {
  valid: true;
  promoCodeId: string;
  code: string;
  discountType: PromoDiscountType;
  discountValue: number;
  discountAmount: number;
};

export type PromoValidationFailure = {
  valid: false;
  error: PromoErrorCode;
  minOrderAmount?: number;
};

export type PromoValidationResult =
  | PromoValidationSuccess
  | PromoValidationFailure;

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateDiscountAmount(
  promo: Pick<PromoCodeRow, "discount_type" | "discount_value">,
  orderAmount: number
): number {
  if (orderAmount <= 0) return 0;

  if (promo.discount_type === "percent") {
    const pct = Math.min(100, Math.max(0, Number(promo.discount_value)));
    return roundMoney(Math.min(orderAmount, (orderAmount * pct) / 100));
  }

  return roundMoney(Math.min(orderAmount, Number(promo.discount_value)));
}

export function validatePromoCode(
  promo: PromoCodeRow | null,
  orderAmount: number,
  now = new Date()
): PromoValidationResult {
  if (!promo) {
    return { valid: false, error: "not_found" };
  }

  if (!promo.is_active) {
    return { valid: false, error: "inactive" };
  }

  const validFrom = new Date(promo.valid_from);
  if (validFrom > now) {
    return { valid: false, error: "not_yet_valid" };
  }

  if (promo.valid_until) {
    const validUntil = new Date(promo.valid_until);
    if (validUntil <= now) {
      return { valid: false, error: "expired" };
    }
  }

  const minOrder = Number(promo.min_order_amount ?? 0);
  if (orderAmount < minOrder) {
    return {
      valid: false,
      error: "min_order",
      minOrderAmount: minOrder,
    };
  }

  if (promo.max_uses != null && promo.used_count >= promo.max_uses) {
    return { valid: false, error: "max_uses" };
  }

  const discountAmount = calculateDiscountAmount(promo, orderAmount);

  return {
    valid: true,
    promoCodeId: promo.id,
    code: promo.code,
    discountType: promo.discount_type,
    discountValue: Number(promo.discount_value),
    discountAmount,
  };
}

export function getPromoStatus(
  promo: Pick<
    PromoCodeRow,
    "is_active" | "valid_from" | "valid_until" | "max_uses" | "used_count"
  >,
  now = new Date()
): "active" | "inactive" | "expired" | "exhausted" | "scheduled" {
  if (!promo.is_active) return "inactive";

  const validFrom = new Date(promo.valid_from);
  if (validFrom > now) return "scheduled";

  if (promo.valid_until) {
    const validUntil = new Date(promo.valid_until);
    if (validUntil <= now) return "expired";
  }

  if (promo.max_uses != null && promo.used_count >= promo.max_uses) {
    return "exhausted";
  }

  return "active";
}

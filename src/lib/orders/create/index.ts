import { criticalPath } from "@/lib/orders/critical-path-events";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertOrderAccess } from "@/lib/orders/create/pipeline/assert-access";
import { computeOrderPricing } from "@/lib/orders/create/pipeline/compute-pricing";
import { emitOrderSideEffects } from "@/lib/orders/create/pipeline/emit-side-effects";
import { toApi } from "@/lib/orders/create/pipeline/errors";
import { persistOrder } from "@/lib/orders/create/pipeline/persist-order";
import { resolveGuestOrderContext } from "@/lib/orders/create/pipeline/resolve-context";
import { validateOrderCart } from "@/lib/orders/create/pipeline/validate-cart";
import { ok } from "@/lib/orders/create/result";
import type { CreateOrderInput } from "@/lib/orders/create/schema";
import type { CreateOrderResult, OrderDraft } from "@/lib/orders/create/types";
import { isPaymentMethodAllowed } from "@/lib/orders/shared/payment-method";

export type { CreateOrderResult } from "@/lib/orders/create/types";

export async function createOrderFromCart(
  input: CreateOrderInput,
  options?: { idempotencyKey?: string | null }
): Promise<CreateOrderResult> {
  const admin = createAdminClient();
  const ctxResult = await resolveGuestOrderContext(admin, input);
  if (!ctxResult.ok) return toApi(ctxResult.error);

  const { context, demoSessionId } = ctxResult.value;
  const { table, location, org } = context;

  if (!isPaymentMethodAllowed(input.paymentMethod, location, org)) {
    return { error: "This payment method is not available.", status: 400 };
  }

  const items = await validateOrderCart(admin, input, context);
  if (!items.ok) return toApi(items.error);

  const pricing = await computeOrderPricing(admin, {
    lineItems: items.value,
    promoCodeId: input.promoCodeId,
    locationId: table.location_id,
    orgDefaultTaxPercent: org.default_tax_percent,
  });
  if (!pricing.ok) return toApi(pricing.error);

  const modeResult = demoSessionId
    ? ok({ kind: "demo" as const, sessionId: demoSessionId })
    : await assertOrderAccess(admin, input, context);
  if (!modeResult.ok) return toApi(modeResult.error);

  const draft: OrderDraft = {
    context,
    lineItems: items.value,
    pricing: pricing.value,
    mode: modeResult.value,
    input,
  };
  const result = await persistOrder(admin, draft, {
    idempotencyKey: options?.idempotencyKey ?? null,
  });
  if (!result.ok) return toApi(result.error);

  await emitOrderSideEffects(admin, draft, result.value);
  criticalPath.orderCreated({
    orderId: result.value.orderId,
    source: "qr",
    locationId: table.location_id,
    total: result.value.total,
    paymentMethod: input.paymentMethod,
  });
  logger.info(
    draft.mode.kind === "approval" ? "Order awaiting staff approval" : "Order created",
    {
      orderId: result.value.orderId,
      orderNumber: result.value.orderNumber,
      locationId: table.location_id,
    }
  );
  return { data: result.value };
}

import { z } from "zod";
import { type PaymentMethod } from "@/lib/constants";
import { isDemoGuestTableToken } from "@/lib/demo-guest";
import { assertOrderAccess } from "@/lib/orders/create/pipeline/assert-access";
import { computeOrderPricing } from "@/lib/orders/create/pipeline/compute-pricing";
import { emitOrderSideEffects } from "@/lib/orders/create/pipeline/emit-side-effects";
import { toLegacyOrderError } from "@/lib/orders/create/pipeline/errors";
import { persistOrder } from "@/lib/orders/create/pipeline/persist-order";
import { resolveOrderContext } from "@/lib/orders/create/pipeline/resolve-context";
import { validateOrderCart } from "@/lib/orders/create/pipeline/validate-cart";
import type { OrderCreateMode, OrderDraft, ResolvedContext } from "@/lib/orders/create/types";
import { err, ok, type Result } from "@/lib/orders/create/result";
import type { OrderCreateError } from "@/lib/orders/create/result";
import { validateTableSession } from "@/lib/orders/validate-table-session";
import {
  MAX_ITEMS_PER_ORDER,
  MAX_QUANTITY_PER_ITEM,
} from "@/lib/security/order-limits";
import {
  zOptionalEmailNormalized,
  zOrderNotesNullish,
  zOrderNotesOptional,
  zSessionToken,
  zTableToken,
} from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import type { IdempotentOrderData } from "@/lib/orders/idempotency";

const cartItemSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string().min(1).max(200),
  unitPrice: z.number().positive(),
  quantity: z.number().int().min(1).max(MAX_QUANTITY_PER_ITEM),
  notes: zOrderNotesNullish(),
  serveSize: z.string().trim().max(20).nullish(),
  modifiers: z.array(
    z.object({
      modifierId: z.string().uuid(),
      modifierName: z.string().max(200),
      price: z.number().min(0),
    })
  ),
  itemTotal: z.number().positive(),
});

export const createOrderSchema = z.object({
  sessionToken: zSessionToken().optional(),
  tableToken: zTableToken(),
  deviceFingerprint: z.string().min(8).max(128),
  deviceToken: z.string().min(16).max(256).optional(),
  tablePin: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
  items: z.array(cartItemSchema).min(1).max(MAX_ITEMS_PER_ORDER),
  notes: zOrderNotesOptional(500),
  guestEmail: zOptionalEmailNormalized(),
  isTakeaway: z.boolean().optional().default(false),
  paymentMethod: z
    .enum(["unset", "online", "at_bar", "card_at_table"])
    .default("unset"),
  promoCodeId: z.string().uuid().optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

function isPaymentMethodAllowed(
  method: PaymentMethod,
  location: {
    payment_online_enabled: boolean;
    payment_at_bar_enabled: boolean;
    payment_card_at_table_enabled: boolean;
  },
  org: { stripe_onboarded: boolean }
) {
  if (method === "unset") return true;
  if (method === "online") {
    return org.stripe_onboarded && location.payment_online_enabled;
  }
  if (method === "at_bar") return location.payment_at_bar_enabled;
  return location.payment_card_at_table_enabled;
}

export type CreateOrderResult =
  | { data: IdempotentOrderData; error?: never }
  | {
      data?: never;
      error: string;
      status: number;
      products?: string[];
      blockedUntil?: string;
    };

async function resolveCreateMode(
  admin: ReturnType<typeof createAdminClient>,
  input: CreateOrderInput,
  context: ResolvedContext,
  isDemo: boolean,
  demoSessionId?: string
): Promise<Result<OrderCreateMode, OrderCreateError>> {
  if (isDemo) {
    return ok({ kind: "demo", sessionId: demoSessionId! });
  }

  return assertOrderAccess(admin, input, context, isDemo);
}

export async function createOrderFromCart(
  input: CreateOrderInput,
  options?: { idempotencyKey?: string | null }
): Promise<CreateOrderResult> {
  const admin = createAdminClient();
  const idempotencyKey = options?.idempotencyKey ?? null;
  const isDemo = isDemoGuestTableToken(input.tableToken);

  let orderContext: ResolvedContext;
  let demoSessionId: string | undefined;

  if (isDemo) {
    if (!input.sessionToken) {
      return { error: "Session required.", status: 401 };
    }

    const sessionResult = await validateTableSession(
      admin,
      input.tableToken,
      input.sessionToken
    );
    if ("error" in sessionResult) {
      return { error: sessionResult.error, status: sessionResult.status };
    }

    orderContext = {
      table: sessionResult.data.table,
      location: sessionResult.data.location,
      org: sessionResult.data.org,
    };
    demoSessionId = sessionResult.data.session.id;
  } else {
    const contextResult = await resolveOrderContext(admin, input.tableToken);
    if (!contextResult.ok) {
      return toLegacyOrderError(contextResult.error);
    }
    orderContext = contextResult.value;
  }

  const { table: tableRow, location: locationRow, org: orgRow } = orderContext;

  if (!isPaymentMethodAllowed(input.paymentMethod, locationRow, orgRow)) {
    return { error: "This payment method is not available.", status: 400 };
  }

  const cartResult = await validateOrderCart(admin, input, orderContext);
  if (!cartResult.ok) {
    return toLegacyOrderError(cartResult.error);
  }

  const pricingResult = await computeOrderPricing(admin, {
    lineItems: cartResult.value,
    promoCodeId: input.promoCodeId,
    locationId: tableRow.location_id,
    orgDefaultTaxPercent: orgRow.default_tax_percent,
  });
  if (!pricingResult.ok) {
    return toLegacyOrderError(pricingResult.error);
  }

  const modeResult = await resolveCreateMode(
    admin,
    input,
    orderContext,
    isDemo,
    demoSessionId
  );
  if (!modeResult.ok) {
    return toLegacyOrderError(modeResult.error);
  }

  const draft: OrderDraft = {
    context: orderContext,
    lineItems: cartResult.value,
    pricing: pricingResult.value,
    mode: modeResult.value,
    input,
  };

  const persistResult = await persistOrder(admin, draft, { idempotencyKey });
  if (!persistResult.ok) {
    return toLegacyOrderError(persistResult.error);
  }

  await emitOrderSideEffects(admin, draft, persistResult.value);

  if (draft.mode.kind === "approval") {
    logger.info("Order awaiting staff approval", {
      orderId: persistResult.value.orderId,
      orderNumber: persistResult.value.orderNumber,
      locationId: tableRow.location_id,
    });
  } else {
    logger.info("Order created", {
      orderId: persistResult.value.orderId,
      orderNumber: persistResult.value.orderNumber,
      locationId: tableRow.location_id,
    });
  }

  return { data: persistResult.value };
}

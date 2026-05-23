import { z } from "zod";
import { type PaymentMethod } from "@/lib/constants";
import { validateTableSession } from "@/lib/orders/validate-table-session";
import {
  MAX_ITEMS_PER_ORDER,
  MAX_QUANTITY_PER_ITEM,
  PRICE_EPSILON,
  validateOrderItems,
  validateOrderTotal,
} from "@/lib/security/order-limits";
import { sanitizeOrderNotes } from "@/lib/security/sanitize";
import {
  zOptionalEmailNormalized,
  zOrderNotesNullish,
  zOrderNotesOptional,
  zSessionToken,
  zTableToken,
} from "@/lib/security/zod-fields";
import { serveSizeOrderNote } from "@/lib/serve-size";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  calculateOrderTaxFromItems,
  resolveItemTaxRate,
} from "@/lib/tax/vat";
import { scheduleOrderTseSign } from "@/lib/fiscal/sign-transaction";
import { logger } from "@/lib/logger";
import { scheduleNewOrderPush } from "@/lib/push/schedule-notify";
import { dispatchOrgWebhook } from "@/lib/webhooks/dispatch";
import {
  validatePromoCode,
  type PromoCodeRow,
  type PromoErrorCode,
} from "@/lib/promo/validate-promo";

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
  sessionToken: zSessionToken(),
  tableToken: zTableToken(),
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

const PROMO_ERROR_MESSAGES: Record<PromoErrorCode, string> = {
  not_found: "Invalid promo code.",
  inactive: "This promo code is not active.",
  not_yet_valid: "This promo code is not valid yet.",
  expired: "This promo code has expired.",
  min_order: "Order total does not meet the minimum for this promo code.",
  max_uses: "This promo code has reached its usage limit.",
};

async function resolvePromoDiscount(
  admin: ReturnType<typeof createAdminClient>,
  promoCodeId: string | undefined,
  locationId: string,
  preDiscountTotal: number
): Promise<
  | { discountAmount: number; promoCodeId: string | null }
  | { error: string; status: number }
> {
  if (!promoCodeId) {
    return { discountAmount: 0, promoCodeId: null };
  }

  const { data: promo } = await admin
    .from("promo_codes")
    .select("*")
    .eq("id", promoCodeId)
    .eq("location_id", locationId)
    .maybeSingle();

  const result = validatePromoCode(promo as PromoCodeRow | null, preDiscountTotal);
  if (!result.valid) {
    return {
      error: PROMO_ERROR_MESSAGES[result.error],
      status: 400,
    };
  }

  return {
    discountAmount: result.discountAmount,
    promoCodeId: result.promoCodeId,
  };
}

async function consumePromoCode(
  admin: ReturnType<typeof createAdminClient>,
  promoCodeId: string
) {
  const { data, error } = await admin.rpc("increment_promo_used_count", {
    p_promo_id: promoCodeId,
  });

  if (error || !data) {
    logger.warn("Promo code usage increment failed", {
      promoCodeId,
      error: error?.message,
    });
  }
}

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

export async function createOrderFromCart(input: CreateOrderInput) {
  const admin = createAdminClient();

  const sessionResult = await validateTableSession(
    admin,
    input.tableToken,
    input.sessionToken
  );

  if ("error" in sessionResult) {
    return { error: sessionResult.error, status: sessionResult.status };
  }

  const { table: tableRow, session: sessionRow, org: orgRow, location: locationRow } =
    sessionResult.data;
  const taxPercent = Number(orgRow.default_tax_percent ?? 19);
  const currency = orgRow.currency ?? "EUR";

  if (
    !isPaymentMethodAllowed(
      input.paymentMethod,
      locationRow,
      orgRow
    )
  ) {
    return { error: "This payment method is not available.", status: 400 };
  }

  const itemsError = validateOrderItems(
    input.items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      productName: i.productName,
    }))
  );
  if (itemsError) {
    return { error: itemsError, status: 400 };
  }

  const { data: pendingOrder } = await admin
    .from("orders")
    .select("id, subtotal, tax_percent, payment_status, stripe_payment_intent_id")
    .eq("session_id", sessionRow.id)
    .eq("status", "pending")
    .in("payment_status", ["pending", "processing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const pendingRow = pendingOrder as {
    id: string;
    subtotal: number;
    tax_percent: number;
    payment_status: string;
    stripe_payment_intent_id: string | null;
  } | null;

  const productIds = [...new Set(input.items.map((i) => i.productId))];
  const modifierIds = [
    ...new Set(input.items.flatMap((i) => i.modifiers.map((m) => m.modifierId))),
  ];

  const { data: products } = await admin
    .from("products")
    .select("id, name, price, is_available, location_id, category_id, tax_rate")
    .in("id", productIds)
    .eq("location_id", tableRow.location_id)
    .is("deleted_at", null);

  const allProducts = (products ?? []) as Array<{
    id: string;
    name: string;
    price: number;
    is_available: boolean;
    location_id: string;
    category_id: string;
    tax_rate: number | null;
  }>;

  const unavailableNames = productIds
    .map((id) => allProducts.find((p) => p.id === id))
    .filter((p) => !p || !p.is_available)
    .map((p) => p?.name ?? "Unknown product");

  if (unavailableNames.length > 0) {
    return {
      error: "unavailable_products",
      status: 400,
      products: unavailableNames,
    };
  }

  const productMap = new Map(allProducts.map((p) => [p.id, p]));

  if (productMap.size !== productIds.length) {
    return { error: "One or more products are unavailable.", status: 400 };
  }

  const categoryIds = [
    ...new Set([...productMap.values()].map((p) => p.category_id)),
  ];

  const { data: categories } = await admin
    .from("categories")
    .select("id, menu_section")
    .in("id", categoryIds)
    .is("deleted_at", null);

  const categorySectionMap = new Map(
    (categories ?? []).map((c) => [
      (c as { id: string }).id,
      (c as { menu_section: string }).menu_section as
        | "drinks"
        | "food"
        | "desserts",
    ])
  );

  let modifierMap = new Map<
    string,
    { id: string; name: string; price: number; is_available: boolean }
  >();

  if (modifierIds.length > 0) {
    const { data: modifiers } = await admin
      .from("modifiers")
      .select("id, name, price, is_available, group_id")
      .in("id", modifierIds)
      .eq("is_available", true);

    const groupIds = [
      ...new Set(
        (modifiers ?? []).map((m) => (m as { group_id: string }).group_id)
      ),
    ];

    const { data: groups } = await admin
      .from("modifier_groups")
      .select("id, product_id")
      .in("id", groupIds);

    const allowedGroupIds = new Set(
      (groups ?? [])
        .filter((g) =>
          productIds.includes((g as { product_id: string }).product_id)
        )
        .map((g) => (g as { id: string }).id)
    );

    const validModifiers = (modifiers ?? []).filter((m) =>
      allowedGroupIds.has((m as { group_id: string }).group_id)
    );

    modifierMap = new Map(
      validModifiers.map((m) => [
        (m as { id: string }).id,
        m as { id: string; name: string; price: number; is_available: boolean },
      ])
    );

    if (modifierMap.size !== modifierIds.length) {
      return { error: "One or more modifiers are unavailable.", status: 400 };
    }
  }

  for (const item of input.items) {
    const product = productMap.get(item.productId)!;
    const serverUnitPrice = Number(product.price);

    if (Math.abs(item.unitPrice - serverUnitPrice) > PRICE_EPSILON) {
      return {
        error: "Price mismatch detected. Please refresh the menu.",
        status: 400,
      };
    }

    for (const mod of item.modifiers) {
      const serverMod = modifierMap.get(mod.modifierId);
      if (!serverMod) continue;
      if (Math.abs(mod.price - Number(serverMod.price)) > PRICE_EPSILON) {
        return {
          error: "Modifier price mismatch detected. Please refresh the menu.",
          status: 400,
        };
      }
    }
  }

  const validatedItems = input.items.map((item) => {
    const product = productMap.get(item.productId)!;
    const mods = item.modifiers.map((m) => {
      const mod = modifierMap.get(m.modifierId)!;
      return {
        modifierId: mod.id,
        modifierName: mod.name,
        price: Number(mod.price),
      };
    });
    const unitWithMods =
      Number(product.price) + mods.reduce((s, m) => s + m.price, 0);
    const itemTotal = unitWithMods * item.quantity;

    const serveNote = serveSizeOrderNote(item.serveSize);
    const combinedNotes = [serveNote, item.notes ? sanitizeOrderNotes(item.notes) : ""]
      .filter(Boolean)
      .join(" · ");

    const menuSection =
      categorySectionMap.get(product.category_id) ?? ("food" as const);
    const productTaxRate =
      product.tax_rate != null ? Number(product.tax_rate) : null;
    const taxRate = resolveItemTaxRate({
      productTaxRate,
      menuSection,
      isTakeaway: input.isTakeaway,
      orgDefaultRate: taxPercent,
    });

    return {
      ...item,
      notes: combinedNotes,
      productName: product.name,
      menuSection,
      productTaxRate,
      taxRate,
      modifiers: mods,
      unitPrice: Number(product.price),
      itemTotal,
    };
  });

  const subtotal = validatedItems.reduce((s, i) => s + i.itemTotal, 0);
  const taxResult = calculateOrderTaxFromItems(
    validatedItems.map((item) => ({
      lineTotal: item.itemTotal,
      taxRate: item.taxRate,
    }))
  );
  const taxAmount = taxResult.taxAmount;
  const effectiveTaxPercent = taxResult.effectiveTaxPercent || taxPercent;
  const total = taxResult.total;

  const totalError = validateOrderTotal(total);
  if (totalError) {
    return { error: totalError, status: 400 };
  }

  const promoResult = await resolvePromoDiscount(
    admin,
    input.promoCodeId,
    tableRow.location_id,
    total
  );
  if ("error" in promoResult) {
    return { error: promoResult.error, status: promoResult.status };
  }

  const discountAmount = promoResult.discountAmount;
  const promoCodeId = promoResult.promoCodeId;
  const finalTotal = Math.max(0, Math.round((total - discountAmount) * 100) / 100);

  async function saveOrderItems(orderId: string) {
    for (const item of validatedItems) {
      const unitWithMods =
        item.unitPrice + item.modifiers.reduce((s, m) => s + m.price, 0);

      const { data: orderItem, error: itemError } = await admin
        .from("order_items")
        .insert({
          order_id: orderId,
          product_id: item.productId,
          product_name: item.productName,
          quantity: item.quantity,
          unit_price: unitWithMods,
          notes: item.notes || null,
          total: item.itemTotal,
          menu_section: item.menuSection,
          tax_rate: item.taxRate,
        })
        .select("id")
        .single();

      if (itemError || !orderItem) {
        return { error: "Order items could not be saved." as const };
      }

      const oi = orderItem as { id: string };

      if (item.modifiers.length) {
        const { error: modError } = await admin
          .from("order_item_modifiers")
          .insert(
            item.modifiers.map((m) => ({
              order_item_id: oi.id,
              modifier_id: m.modifierId,
              modifier_name: m.modifierName,
              price: m.price,
            }))
          );

        if (modError) {
          return { error: "Order modifiers could not be saved." as const };
        }
      }
    }

    return null;
  }

  if (pendingRow) {
    const { error: clearError } = await admin
      .from("order_items")
      .delete()
      .eq("order_id", pendingRow.id);

    if (clearError) {
      return { error: "Order could not be updated.", status: 500 };
    }

    const saveError = await saveOrderItems(pendingRow.id);
    if (saveError) {
      return { error: saveError.error, status: 500 };
    }

    const { data: updatedOrder, error: updateError } = await admin
      .from("orders")
      .update({
        subtotal,
        tax_percent: effectiveTaxPercent,
        tax_amount: taxAmount,
        total: finalTotal,
        discount_amount: discountAmount,
        promo_code_id: promoCodeId,
        is_takeaway: input.isTakeaway,
        payment_status: "pending",
        payment_method: input.paymentMethod,
        stripe_payment_intent_id: null,
        tip_amount: 0,
        tip_staff_id: null,
      })
      .eq("id", pendingRow.id)
      .select("id, order_number, total, tax_percent")
      .single();

    if (updateError || !updatedOrder) {
      return { error: "Order could not be updated.", status: 500 };
    }

    const merged = updatedOrder as {
      id: string;
      order_number: number;
      total: number;
      tax_percent: number;
    };

    if (input.guestEmail) {
      await admin
        .from("table_sessions")
        .update({ guest_email: input.guestEmail })
        .eq("id", sessionRow.id);
    }

    scheduleOrderTseSign(merged.id);
    scheduleNewOrderPush(
      tableRow.location_id,
      merged.order_number,
      tableRow.name
    );

    dispatchOrgWebhook(orgRow.id, "order.created", {
      order_id: merged.id,
      order_number: merged.order_number,
      location_id: tableRow.location_id,
      total: merged.total,
    });

    if (promoCodeId) {
      await consumePromoCode(admin, promoCodeId);
    }

    logger.info("Order created", {
      orderId: merged.id,
      orderNumber: merged.order_number,
      merged: true,
      locationId: tableRow.location_id,
    });

    return {
      data: {
        orderId: merged.id,
        orderNumber: merged.order_number,
        total: merged.total,
        taxPercent: merged.tax_percent,
        tableName: tableRow.name,
        currency,
        orgId: orgRow.id,
        locationId: tableRow.location_id,
        merged: true,
      },
    };
  }

  const { data: orderNumber, error: numError } = await admin.rpc(
    "get_next_order_number",
    { p_location_id: tableRow.location_id }
  );

  if (numError || orderNumber == null) {
    return { error: "Order number could not be generated.", status: 500 };
  }

  const prepMinutes = 8;
  const sanitizedNotes = input.notes ? sanitizeOrderNotes(input.notes) : null;

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      location_id: tableRow.location_id,
      table_id: tableRow.id,
      session_id: sessionRow.id,
      order_number: orderNumber as number,
      subtotal,
      tax_percent: effectiveTaxPercent,
      tax_amount: taxAmount,
      total: finalTotal,
      discount_amount: discountAmount,
      promo_code_id: promoCodeId,
      is_takeaway: input.isTakeaway,
      notes: sanitizedNotes,
      estimated_prep_minutes: prepMinutes,
      status: "pending",
      payment_status: "pending",
      payment_method: input.paymentMethod,
      tip_amount: 0,
      tip_staff_id: null,
    })
    .select("id, order_number, total, tax_percent")
    .single();

  if (orderError || !order) {
    return { error: "Order could not be created.", status: 500 };
  }

  const orderRow = order as {
    id: string;
    order_number: number;
    total: number;
    tax_percent: number;
  };

  const saveError = await saveOrderItems(orderRow.id);
  if (saveError) {
    await admin.from("orders").delete().eq("id", orderRow.id);
    return { error: saveError.error, status: 500 };
  }

  if (input.guestEmail) {
    await admin
      .from("table_sessions")
      .update({ guest_email: input.guestEmail })
      .eq("id", sessionRow.id);
  }

  scheduleOrderTseSign(orderRow.id);
  scheduleNewOrderPush(
    tableRow.location_id,
    orderRow.order_number,
    tableRow.name
  );

  dispatchOrgWebhook(orgRow.id, "order.created", {
    order_id: orderRow.id,
    order_number: orderRow.order_number,
    location_id: tableRow.location_id,
    total: orderRow.total,
  });

  if (promoCodeId) {
    await consumePromoCode(admin, promoCodeId);
  }

  logger.info("Order created", {
    orderId: orderRow.id,
    orderNumber: orderRow.order_number,
    locationId: tableRow.location_id,
  });

  return {
    data: {
      orderId: orderRow.id,
      orderNumber: orderRow.order_number,
      total: orderRow.total,
      taxPercent: orderRow.tax_percent,
      tableName: tableRow.name,
      currency,
      orgId: orgRow.id,
      locationId: tableRow.location_id,
    },
  };
}

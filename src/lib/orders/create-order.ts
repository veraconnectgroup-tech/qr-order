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
import { sanitizeText } from "@/lib/security/sanitize";
import { serveSizeOrderNote } from "@/lib/serve-size";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  calculateOrderTaxFromItems,
  resolveItemTaxRate,
} from "@/lib/tax/vat";

const cartItemSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string().min(1).max(200),
  unitPrice: z.number().positive(),
  quantity: z.number().int().min(1).max(MAX_QUANTITY_PER_ITEM),
  notes: z
    .string()
    .max(500)
    .nullish()
    .transform((v) => v ?? ""),
  serveSize: z.string().max(20).nullish(),
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
  sessionToken: z.string().min(1),
  tableToken: z.string().min(1),
  items: z.array(cartItemSchema).min(1).max(MAX_ITEMS_PER_ORDER),
  notes: z.string().max(1000).optional(),
  guestEmail: z.string().email().optional().or(z.literal("")),
  isTakeaway: z.boolean().optional().default(false),
  paymentMethod: z
    .enum(["unset", "online", "at_bar", "card_at_table"])
    .default("unset"),
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
    .eq("is_available", true);

  const productMap = new Map(
    (products ?? []).map((p) => [
      (p as { id: string }).id,
      p as {
        id: string;
        name: string;
        price: number;
        is_available: boolean;
        location_id: string;
        category_id: string;
        tax_rate: number | null;
      },
    ])
  );

  if (productMap.size !== productIds.length) {
    return { error: "One or more products are unavailable.", status: 400 };
  }

  const categoryIds = [
    ...new Set([...productMap.values()].map((p) => p.category_id)),
  ];

  const { data: categories } = await admin
    .from("categories")
    .select("id, menu_section")
    .in("id", categoryIds);

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
    const combinedNotes = [serveNote, sanitizeText(item.notes, 500)]
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
        total,
        is_takeaway: input.isTakeaway,
        payment_status: "pending",
        payment_method: input.paymentMethod,
        stripe_payment_intent_id: null,
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
  const sanitizedNotes = input.notes
    ? sanitizeText(input.notes, 1000)
    : null;

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
      total,
      is_takeaway: input.isTakeaway,
      notes: sanitizedNotes,
      estimated_prep_minutes: prepMinutes,
      status: "pending",
      payment_status: "pending",
      payment_method: input.paymentMethod,
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

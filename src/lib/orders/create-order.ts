import { z } from "zod";
import { ORDER_RATE_LIMIT_SECONDS } from "@/lib/constants";
import { validateTableSession } from "@/lib/orders/validate-table-session";
import {
  MAX_ITEMS_PER_ORDER,
  MAX_QUANTITY_PER_ITEM,
  PRICE_EPSILON,
  validateOrderItems,
  validateOrderTotal,
} from "@/lib/security/order-limits";
import { sanitizeText } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";

const cartItemSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string().min(1).max(200),
  unitPrice: z.number().positive(),
  quantity: z.number().int().min(1).max(MAX_QUANTITY_PER_ITEM),
  notes: z.string().max(500).default(""),
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
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

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

  const { table: tableRow, session: sessionRow, org: orgRow } = sessionResult.data;
  const taxPercent = Number(orgRow.default_tax_percent ?? 19);
  const currency = orgRow.currency ?? "EUR";

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

  const recentCutoff = new Date(
    Date.now() - ORDER_RATE_LIMIT_SECONDS * 1000
  ).toISOString();

  const { data: recentOrder } = await admin
    .from("orders")
    .select("id")
    .eq("session_id", sessionRow.id)
    .gte("created_at", recentCutoff)
    .limit(1)
    .maybeSingle();

  if (recentOrder) {
    return {
      error: "Please wait before placing another order.",
      status: 429,
    };
  }

  const productIds = [...new Set(input.items.map((i) => i.productId))];
  const modifierIds = [
    ...new Set(input.items.flatMap((i) => i.modifiers.map((m) => m.modifierId))),
  ];

  const { data: products } = await admin
    .from("products")
    .select("id, name, price, is_available, location_id")
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
      },
    ])
  );

  if (productMap.size !== productIds.length) {
    return { error: "One or more products are unavailable.", status: 400 };
  }

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

    return {
      ...item,
      notes: sanitizeText(item.notes, 500),
      productName: product.name,
      modifiers: mods,
      unitPrice: Number(product.price),
      itemTotal,
    };
  });

  const subtotal = validatedItems.reduce((s, i) => s + i.itemTotal, 0);
  const taxAmount = subtotal * (taxPercent / 100);
  const total = subtotal + taxAmount;

  const totalError = validateOrderTotal(total);
  if (totalError) {
    return { error: totalError, status: 400 };
  }

  const { data: orderNumber, error: numError } = await admin.rpc(
    "get_next_order_number",
    { p_location_id: tableRow.location_id }
  );

  if (numError || orderNumber == null) {
    return { error: "Broj porudžbine nije generisan.", status: 500 };
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
      tax_percent: taxPercent,
      tax_amount: taxAmount,
      total,
      notes: sanitizedNotes,
      estimated_prep_minutes: prepMinutes,
      status: "pending",
      payment_status: "pending",
    })
    .select("id, order_number, total, tax_percent")
    .single();

  if (orderError || !order) {
    return { error: "Porudžbina nije kreirana.", status: 500 };
  }

  const orderRow = order as {
    id: string;
    order_number: number;
    total: number;
    tax_percent: number;
  };

  for (const item of validatedItems) {
    const unitWithMods =
      item.unitPrice +
      item.modifiers.reduce((s, m) => s + m.price, 0);

    const { data: orderItem, error: itemError } = await admin
      .from("order_items")
      .insert({
        order_id: orderRow.id,
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        unit_price: unitWithMods,
        notes: item.notes || null,
        total: item.itemTotal,
      })
      .select("id")
      .single();

    if (itemError || !orderItem) {
      await admin.from("orders").delete().eq("id", orderRow.id);
      return { error: "Order items could not be saved.", status: 500 };
    }

    const oi = orderItem as { id: string };

    if (item.modifiers.length) {
      const { error: modError } = await admin.from("order_item_modifiers").insert(
        item.modifiers.map((m) => ({
          order_item_id: oi.id,
          modifier_id: m.modifierId,
          modifier_name: m.modifierName,
          price: m.price,
        }))
      );

      if (modError) {
        await admin.from("orders").delete().eq("id", orderRow.id);
        return { error: "Order modifiers could not be saved.", status: 500 };
      }
    }
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

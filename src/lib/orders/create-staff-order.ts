import { z } from "zod";
import type { PaymentMethod } from "@/lib/constants";
import {
  MAX_ITEMS_PER_ORDER,
  MAX_QUANTITY_PER_ITEM,
  validateOrderItems,
  validateOrderTotal,
} from "@/lib/security/order-limits";
import { sanitizeOrderNotes } from "@/lib/security/sanitize";
import {
  zOrderNotesNullish,
  zOrderNotesOptional,
  zUuid,
} from "@/lib/security/zod-fields";
import { createActiveSessionWithPin } from "@/lib/sessions/session-devices";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  calculateOrderTaxFromItems,
  resolveItemTaxRate,
} from "@/lib/tax/vat";
import { logger } from "@/lib/logger";
import { persistOrderSideEffects } from "@/lib/outbox/persist-order-side-effects";
import type { Staff } from "@/types";

const staffOrderItemSchema = z.object({
  productId: zUuid(),
  quantity: z.number().int().min(1).max(MAX_QUANTITY_PER_ITEM),
  notes: zOrderNotesNullish(),
  modifiers: z
    .array(z.object({ modifierId: zUuid() }))
    .optional()
    .default([]),
});

export const createStaffOrderSchema = z.object({
  tableId: zUuid(),
  items: z.array(staffOrderItemSchema).min(1).max(MAX_ITEMS_PER_ORDER),
  paymentMethod: z.enum(["at_bar", "card_at_table", "online"]),
  notes: zOrderNotesOptional(500),
  isTakeaway: z.boolean().optional().default(false),
});

export type CreateStaffOrderInput = z.infer<typeof createStaffOrderSchema>;

function isPaymentMethodAllowed(
  method: PaymentMethod,
  location: {
    payment_online_enabled: boolean;
    payment_at_bar_enabled: boolean;
    payment_card_at_table_enabled: boolean;
  },
  org: { stripe_onboarded: boolean }
) {
  if (method === "online") {
    return org.stripe_onboarded && location.payment_online_enabled;
  }
  if (method === "at_bar") return location.payment_at_bar_enabled;
  return location.payment_card_at_table_enabled;
}

function staffCanAccessLocation(
  staff: Staff,
  locationId: string,
  locationOrgId: string
) {
  if (staff.org_id !== locationOrgId) return false;
  if (staff.location_id && staff.location_id !== locationId) return false;
  return true;
}

export async function createStaffOrder(
  staff: Staff,
  input: CreateStaffOrderInput
) {
  // 1. Validate staff auth + role
  if (!["owner", "manager", "staff"].includes(staff.role)) {
    return { error: "Unauthorized.", status: 403 };
  }

  const admin = createAdminClient();

  // 2. Validate table exists, active, belongs to staff's location
  const { data: table } = await admin
    .from("tables")
    .select("id, name, location_id, is_active, deleted_at")
    .eq("id", input.tableId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  const tableRow = table as {
    id: string;
    name: string;
    location_id: string;
    is_active: boolean;
    deleted_at: string | null;
  } | null;

  if (!tableRow) {
    return { error: "Table not found.", status: 404 };
  }

  const { data: location } = await admin
    .from("locations")
    .select(
      "id, org_id, accepting_orders, payment_online_enabled, payment_at_bar_enabled, payment_card_at_table_enabled"
    )
    .eq("id", tableRow.location_id)
    .maybeSingle();

  const locationRow = location as {
    id: string;
    org_id: string;
    accepting_orders: boolean;
    payment_online_enabled: boolean;
    payment_at_bar_enabled: boolean;
    payment_card_at_table_enabled: boolean;
  } | null;

  if (!locationRow) {
    return { error: "Location not found.", status: 404 };
  }

  if (!staffCanAccessLocation(staff, locationRow.id, locationRow.org_id)) {
    return { error: "Unauthorized.", status: 403 };
  }

  if (!locationRow.accepting_orders) {
    return { error: "This location is not accepting orders.", status: 400 };
  }

  // 3. Load org config (default_tax_percent, currency)
  const { data: orgData } = await admin
    .from("organizations")
    .select("id, currency, default_tax_percent, stripe_onboarded")
    .eq("id", locationRow.org_id)
    .maybeSingle();

  const orgRow = orgData as {
    id: string;
    currency: string;
    default_tax_percent: number;
    stripe_onboarded: boolean;
  } | null;

  if (!orgRow) {
    return { error: "Organization not found.", status: 500 };
  }

  if (!isPaymentMethodAllowed(input.paymentMethod, locationRow, orgRow)) {
    return { error: "This payment method is not available.", status: 400 };
  }

  const itemsError = validateOrderItems(
    input.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    }))
  );
  if (itemsError) {
    return { error: itemsError, status: 400 };
  }

  const productIds = [...new Set(input.items.map((item) => item.productId))];
  const modifierIds = [
    ...new Set(
      input.items.flatMap((item) => item.modifiers.map((mod) => mod.modifierId))
    ),
  ];

  // 4. Validate products exist, available, same location, not deleted
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
    .map((id) => allProducts.find((product) => product.id === id))
    .filter((product) => !product || !product.is_available)
    .map((product) => product?.name ?? "Unknown product");

  if (unavailableNames.length > 0) {
    return {
      error: "unavailable_products",
      status: 400,
      products: unavailableNames,
    };
  }

  const productMap = new Map(allProducts.map((product) => [product.id, product]));

  if (productMap.size !== productIds.length) {
    return { error: "One or more products are unavailable.", status: 400 };
  }

  const categoryIds = [
    ...new Set([...productMap.values()].map((product) => product.category_id)),
  ];

  // 5. Load categories for menu_section per product
  const { data: categories } = await admin
    .from("categories")
    .select("id, menu_section")
    .in("id", categoryIds)
    .is("deleted_at", null);

  const categorySectionMap = new Map(
    (categories ?? []).map((category) => [
      (category as { id: string }).id,
      (category as { menu_section: string }).menu_section as
        | "drinks"
        | "food"
        | "desserts",
    ])
  );

  // 6. Validate modifiers (belong to products, available)
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
        (modifiers ?? []).map(
          (modifier) => (modifier as { group_id: string }).group_id
        )
      ),
    ];

    const { data: groups } = await admin
      .from("modifier_groups")
      .select("id, product_id")
      .in("id", groupIds);

    const allowedGroupIds = new Set(
      (groups ?? [])
        .filter((group) =>
          productIds.includes((group as { product_id: string }).product_id)
        )
        .map((group) => (group as { id: string }).id)
    );

    const validModifiers = (modifiers ?? []).filter((modifier) =>
      allowedGroupIds.has((modifier as { group_id: string }).group_id)
    );

    modifierMap = new Map(
      validModifiers.map((modifier) => [
        (modifier as { id: string }).id,
        modifier as {
          id: string;
          name: string;
          price: number;
          is_available: boolean;
        },
      ])
    );

    if (modifierMap.size !== modifierIds.length) {
      return { error: "One or more modifiers are unavailable.", status: 400 };
    }
  }

  const taxPercent = Number(orgRow.default_tax_percent ?? 19);

  // 7. resolveItemTaxRate per item + calculateOrderTaxFromItems
  const validatedItems = input.items.map((item) => {
    const product = productMap.get(item.productId)!;
    const mods = item.modifiers.map((modifier) => {
      const mod = modifierMap.get(modifier.modifierId)!;
      return {
        modifierId: mod.id,
        modifierName: mod.name,
        price: Number(mod.price),
      };
    });
    const unitWithMods =
      Number(product.price) + mods.reduce((sum, mod) => sum + mod.price, 0);
    const itemTotal = unitWithMods * item.quantity;

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
      productId: item.productId,
      productName: product.name,
      quantity: item.quantity,
      notes: item.notes ? sanitizeOrderNotes(item.notes) : "",
      menuSection,
      taxRate,
      modifiers: mods,
      unitPrice: Number(product.price),
      itemTotal,
    };
  });

  const subtotal = validatedItems.reduce((sum, item) => sum + item.itemTotal, 0);
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

  // 8. Open shared table session (staff bypasses guest approval)
  const sessionResult = await createActiveSessionWithPin(admin, {
    tableId: tableRow.id,
    locationId: locationRow.id,
    approvedByStaffId: staff.id,
  });

  if ("error" in sessionResult) {
    return { error: sessionResult.error, status: sessionResult.status };
  }

  // 9. get_next_order_number RPC
  const { data: orderNumber, error: numError } = await admin.rpc(
    "get_next_order_number",
    { p_location_id: locationRow.id }
  );

  if (numError || orderNumber == null) {
    return { error: "Order number could not be generated.", status: 500 };
  }

  const now = new Date().toISOString();
  const prepMinutes = 8;
  const sanitizedNotes = input.notes ? sanitizeOrderNotes(input.notes) : null;

  // 10. Insert order: status='accepted', order_source='staff'
  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      location_id: locationRow.id,
      table_id: tableRow.id,
      session_id: sessionResult.sessionId,
      order_number: orderNumber as number,
      subtotal,
      tax_percent: effectiveTaxPercent,
      tax_amount: taxAmount,
      total,
      discount_amount: 0,
      promo_code_id: null,
      is_takeaway: input.isTakeaway,
      notes: sanitizedNotes,
      estimated_prep_minutes: prepMinutes,
      status: "accepted",
      accepted_at: now,
      payment_status: "pending",
      payment_method: input.paymentMethod,
      tip_amount: 0,
      tip_staff_id: null,
      order_source: "staff",
      created_by_staff_id: staff.id,
    })
    .select("id, order_number, total")
    .single();

  if (orderError || !order) {
    return { error: "Order could not be created.", status: 500 };
  }

  const orderRow = order as {
    id: string;
    order_number: number;
    total: number;
  };

  // 11. Insert order_items + order_item_modifiers
  for (const item of validatedItems) {
    const unitWithMods =
      item.unitPrice + item.modifiers.reduce((sum, mod) => sum + mod.price, 0);

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
        menu_section: item.menuSection,
        tax_rate: item.taxRate,
      })
      .select("id")
      .single();

    if (itemError || !orderItem) {
      await admin.from("orders").delete().eq("id", orderRow.id);
      return { error: "Order items could not be saved.", status: 500 };
    }

    if (item.modifiers.length) {
      const { error: modError } = await admin
        .from("order_item_modifiers")
        .insert(
          item.modifiers.map((mod) => ({
            order_item_id: (orderItem as { id: string }).id,
            modifier_id: mod.modifierId,
            modifier_name: mod.modifierName,
            price: mod.price,
          }))
        );

      if (modError) {
        await admin.from("orders").delete().eq("id", orderRow.id);
        return { error: "Order modifiers could not be saved.", status: 500 };
      }
    }
  }

  // 12. Outbox + legacy side effects (A7/A8 remove direct calls)
  await persistOrderSideEffects(admin, {
    orderId: orderRow.id,
    locationId: locationRow.id,
    orgId: staff.org_id,
    orderNumber: orderRow.order_number,
    tableName: tableRow.name,
    total: orderRow.total,
    paymentStatus: "pending",
    orderSource: "staff",
    phase: "created",
    actorType: "staff",
    actorId: staff.id,
  });

  logger.info("Staff order created", {
    orderId: orderRow.id,
    orderNumber: orderRow.order_number,
    locationId: locationRow.id,
    staffId: staff.id,
    sessionId: sessionResult.sessionId,
  });

  // 14. Return { orderId, orderNumber, total, tableName }
  return {
    data: {
      orderId: orderRow.id,
      orderNumber: orderRow.order_number,
      total: orderRow.total,
      tableName: tableRow.name,
    },
  };
}

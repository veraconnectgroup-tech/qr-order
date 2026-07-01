import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueDenisExtendedWebhooks } from "@/lib/webhooks/enqueue-denis-extended-webhook";
import { orgIdForLocation } from "@/lib/webhooks/org-context";
import { logger } from "@/lib/logger";

async function loadOrderWebhookContext(
  admin: SupabaseClient,
  orderId: string
): Promise<{
  orgId: string;
  locationId: string;
  orderNumber: number;
  tableId: string;
  tableName: string;
  total: number;
  sessionId: string | null;
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    price: number;
  }>;
} | null> {
  const { data: orderRow } = await admin
    .from("orders")
    .select("id, order_number, location_id, session_id, total_amount, table_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!orderRow) return null;

  const order = orderRow as {
    id: string;
    order_number: number;
    location_id: string;
    session_id: string | null;
    total_amount: number;
    table_id: string;
  };

  const orgId = await orgIdForLocation(order.location_id);
  if (!orgId) return null;

  const [{ data: tableRow }, { data: itemRows }] = await Promise.all([
    admin.from("tables").select("name").eq("id", order.table_id).maybeSingle(),
    admin
      .from("order_items")
      .select("product_id, product_name, quantity, unit_price")
      .eq("order_id", orderId),
  ]);

  const items = (itemRows ?? []).map((row) => {
    const item = row as {
      product_id: string | null;
      product_name: string;
      quantity: number;
      unit_price: number;
    };
    return {
      productId: item.product_id ?? "",
      name: item.product_name,
      quantity: item.quantity,
      price: Math.round(Number(item.unit_price) * 100),
    };
  });

  return {
    orgId,
    locationId: order.location_id,
    orderNumber: order.order_number,
    tableId: order.table_id,
    tableName: (tableRow as { name: string } | null)?.name ?? "",
    total: Math.round(Number(order.total_amount) * 100),
    sessionId: order.session_id,
    items,
  };
}

async function loadSessionGuestContext(
  admin: SupabaseClient,
  sessionId: string
): Promise<{
  isReturningGuest: boolean;
  guestLanguage: string | null;
  allergyFlags: string[];
}> {
  const { data: sessionRow } = await admin
    .from("table_sessions")
    .select("guest_device_id, locale")
    .eq("id", sessionId)
    .maybeSingle();

  const session = sessionRow as {
    guest_device_id: string | null;
    locale: string | null;
  } | null;

  let isReturningGuest = false;
  if (session?.guest_device_id) {
    const { count } = await admin
      .from("table_sessions")
      .select("id", { count: "exact", head: true })
      .eq("guest_device_id", session.guest_device_id)
      .neq("status", "open");
    isReturningGuest = (count ?? 0) > 0;
  }

  return {
    isReturningGuest,
    guestLanguage: session?.locale ?? null,
    allergyFlags: [],
  };
}

export async function emitDenisOrderSubmitted(
  admin: SupabaseClient,
  input: { orderId: string; allergyFlags?: string[] }
): Promise<void> {
  const ctx = await loadOrderWebhookContext(admin, input.orderId);
  if (!ctx) return;

  let guestContext = {
    isReturningGuest: false,
    guestLanguage: null as string | null,
    allergyFlags: input.allergyFlags ?? [],
  };

  if (ctx.sessionId) {
    const sessionCtx = await loadSessionGuestContext(admin, ctx.sessionId);
    guestContext = {
      ...sessionCtx,
      allergyFlags: input.allergyFlags ?? sessionCtx.allergyFlags,
    };
  }

  try {
    await enqueueDenisExtendedWebhooks(admin, {
      orgId: ctx.orgId,
      locationId: ctx.locationId,
      event: "denis.order.submitted",
      aggregateId: input.orderId,
      data: {
        orderId: input.orderId,
        orderNumber: ctx.orderNumber,
        tableId: ctx.tableId,
        tableName: ctx.tableName,
        items: ctx.items,
        total: ctx.total,
        guestLanguage: guestContext.guestLanguage,
        isReturningGuest: guestContext.isReturningGuest,
        allergyFlags: guestContext.allergyFlags,
      },
    });
  } catch (error) {
    logger.warn("denis.order.submitted enqueue failed", {
      orderId: input.orderId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function emitDenisOrderDelivered(
  admin: SupabaseClient,
  input: { orderId: string; deliveredAt?: string }
): Promise<void> {
  const ctx = await loadOrderWebhookContext(admin, input.orderId);
  if (!ctx) return;

  try {
    await enqueueDenisExtendedWebhooks(admin, {
      orgId: ctx.orgId,
      locationId: ctx.locationId,
      event: "denis.order.delivered",
      aggregateId: input.orderId,
      data: {
        orderId: input.orderId,
        orderNumber: ctx.orderNumber,
        tableId: ctx.tableId,
        tableName: ctx.tableName,
        deliveredAt: input.deliveredAt ?? new Date().toISOString(),
        total: ctx.total,
      },
    });
  } catch (error) {
    logger.warn("denis.order.delivered enqueue failed", {
      orderId: input.orderId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function emitDenisGuestArrived(
  admin: SupabaseClient,
  input: {
    sessionId: string;
    tableId: string;
    tableName: string;
    locationId: string;
  }
): Promise<void> {
  const orgId = await orgIdForLocation(input.locationId);
  if (!orgId) return;

  const guestContext = await loadSessionGuestContext(admin, input.sessionId);

  try {
    await enqueueDenisExtendedWebhooks(admin, {
      orgId,
      locationId: input.locationId,
      event: "denis.guest.arrived",
      aggregateId: input.sessionId,
      data: {
        sessionId: input.sessionId,
        tableId: input.tableId,
        tableName: input.tableName,
        isReturningGuest: guestContext.isReturningGuest,
        guestLanguage: guestContext.guestLanguage,
      },
    });
  } catch (error) {
    logger.warn("denis.guest.arrived enqueue failed", {
      sessionId: input.sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function emitDenisGuestLeft(
  admin: SupabaseClient,
  input: {
    sessionId: string;
    tableId: string;
    tableName: string;
    locationId: string;
    openedAt: string;
    orderCount: number;
    totalSpentCents: number;
  }
): Promise<void> {
  const orgId = await orgIdForLocation(input.locationId);
  if (!orgId) return;

  const durationMinutes = Math.round(
    (Date.now() - Date.parse(input.openedAt)) / 60_000
  );

  try {
    await enqueueDenisExtendedWebhooks(admin, {
      orgId,
      locationId: input.locationId,
      event: "denis.guest.left",
      aggregateId: input.sessionId,
      data: {
        sessionId: input.sessionId,
        tableId: input.tableId,
        tableName: input.tableName,
        orderCount: input.orderCount,
        totalSpent: input.totalSpentCents,
        durationMinutes,
      },
    });
  } catch (error) {
    logger.warn("denis.guest.left enqueue failed", {
      sessionId: input.sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function emitDenisGuestFeedback(
  admin: SupabaseClient,
  input: {
    sessionId: string;
    locationId: string;
    rating: number | null;
    sentiment: "positive" | "neutral" | "negative" | null;
    tags?: string[];
  }
): Promise<void> {
  const orgId = await orgIdForLocation(input.locationId);
  if (!orgId) return;

  try {
    await enqueueDenisExtendedWebhooks(admin, {
      orgId,
      locationId: input.locationId,
      event: "denis.guest.feedback",
      aggregateId: input.sessionId,
      data: {
        sessionId: input.sessionId,
        rating: input.rating,
        sentiment: input.sentiment,
        tags: input.tags ?? [],
      },
    });
  } catch (error) {
    logger.warn("denis.guest.feedback enqueue failed", {
      sessionId: input.sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function emitDenisUpsellConverted(
  admin: SupabaseClient,
  input: {
    sessionId: string;
    locationId: string;
    productId: string;
    productName: string;
    offerType: string;
  }
): Promise<void> {
  const orgId = await orgIdForLocation(input.locationId);
  if (!orgId) return;

  try {
    await enqueueDenisExtendedWebhooks(admin, {
      orgId,
      locationId: input.locationId,
      event: "denis.upsell.converted",
      aggregateId: input.sessionId,
      data: {
        sessionId: input.sessionId,
        productId: input.productId,
        productName: input.productName,
        offerType: input.offerType,
      },
    });
  } catch (error) {
    logger.warn("denis.upsell.converted enqueue failed", {
      sessionId: input.sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function emitDenisAllergyDetected(
  admin: SupabaseClient,
  input: {
    sessionId: string;
    locationId: string;
    tableId: string;
    allergens: string[];
    productId?: string | null;
    productName?: string | null;
    severity: "block" | "warn";
  }
): Promise<void> {
  const orgId = await orgIdForLocation(input.locationId);
  if (!orgId) return;

  try {
    await enqueueDenisExtendedWebhooks(admin, {
      orgId,
      locationId: input.locationId,
      event: "denis.allergy.detected",
      aggregateId: input.sessionId,
      data: {
        sessionId: input.sessionId,
        tableId: input.tableId,
        allergens: input.allergens,
        productId: input.productId ?? null,
        productName: input.productName ?? null,
        severity: input.severity,
      },
    });
  } catch (error) {
    logger.warn("denis.allergy.detected enqueue failed", {
      sessionId: input.sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function emitDenisRushMode(
  admin: SupabaseClient,
  input: {
    locationId: string;
    started: boolean;
    reason: string;
    kdsStress: "normal" | "high";
  }
): Promise<void> {
  const orgId = await orgIdForLocation(input.locationId);
  if (!orgId) return;

  const event = input.started ? "denis.rush.started" : "denis.rush.ended";

  try {
    await enqueueDenisExtendedWebhooks(admin, {
      orgId,
      locationId: input.locationId,
      event,
      aggregateId: input.locationId,
      data: {
        locationId: input.locationId,
        reason: input.reason,
        kdsStress: input.kdsStress,
      },
    });
  } catch (error) {
    logger.warn(`${event} enqueue failed`, {
      locationId: input.locationId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function emitDenisStockDepleted(
  admin: SupabaseClient,
  input: {
    locationId: string;
    productId: string;
    productName: string;
    previousStock?: number | null;
  }
): Promise<void> {
  const orgId = await orgIdForLocation(input.locationId);
  if (!orgId) return;

  try {
    await enqueueDenisExtendedWebhooks(admin, {
      orgId,
      locationId: input.locationId,
      event: "denis.stock.depleted",
      aggregateId: input.productId,
      data: {
        productId: input.productId,
        productName: input.productName,
        previousStock: input.previousStock ?? null,
      },
    });
  } catch (error) {
    logger.warn("denis.stock.depleted enqueue failed", {
      productId: input.productId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function emitDenisStaffAlert(
  admin: SupabaseClient,
  input: {
    locationId: string;
    alertType: string;
    message: string;
    tableId?: string | null;
    priority?: "low" | "medium" | "high";
  }
): Promise<void> {
  const orgId = await orgIdForLocation(input.locationId);
  if (!orgId) return;

  try {
    await enqueueDenisExtendedWebhooks(admin, {
      orgId,
      locationId: input.locationId,
      event: "denis.staff.alert",
      aggregateId: input.tableId ?? input.locationId,
      data: {
        alertType: input.alertType,
        message: input.message,
        tableId: input.tableId ?? null,
        priority: input.priority ?? "medium",
      },
    });
  } catch (error) {
    logger.warn("denis.staff.alert enqueue failed", {
      locationId: input.locationId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

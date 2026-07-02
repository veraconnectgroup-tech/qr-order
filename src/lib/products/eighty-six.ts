import type { NextRequest } from "next/server";
import { auditLog } from "@/lib/audit/log";
import { invalidateMenuCache } from "@/lib/ai/menu-cache-invalidate";
import { invalidateGuestMenuCacheForLocation } from "@/lib/pwa/menu-cache";
import { resolveInventorySubstitutionMessage } from "@/lib/denis/intelligence/apply-order-inventory";
import { isKitchenMenuSection, isDrinksMenuSection } from "@/lib/kitchen/menu-section";
import { scheduleProductUnavailableTell } from "@/lib/outbox/enqueue-product-unavailable-tell";
import type { SupabaseClient } from "@supabase/supabase-js";

export type EightySixStaffRole =
  | "kitchen"
  | "bar"
  | "waiter"
  | "manager"
  | "owner"
  | string;

export type ProductAvailabilityRow = {
  id: string;
  name: string;
  is_available: boolean;
  location_id: string;
  menu_section: string | null;
};

export type EightySixEvent = {
  productId: string;
  productName: string;
  at: string;
  staffUserId: string | null;
};

export type TodayEightySixItem = {
  productId: string;
  productName: string;
  menuSection: string | null;
  eightySixedAt: string | null;
  isAvailable: boolean;
};

const PENDING_ORDER_STATUSES = ["pending", "pending_approval", "accepted"] as const;

export function assertRoleCanSetProductAvailability(input: {
  role: EightySixStaffRole;
  menuSection: string | null;
  makingUnavailable: boolean;
}): { ok: true } | { ok: false; reason: string } {
  const role = input.role;
  const section = input.menuSection;

  if (role === "manager" || role === "owner") {
    return { ok: true };
  }

  if (role === "kitchen") {
    if (!isKitchenMenuSection(section)) {
      return {
        ok: false,
        reason: "Kitchen staff can only update food and dessert items.",
      };
    }
    return { ok: true };
  }

  if (role === "bar") {
    if (!isDrinksMenuSection(section)) {
      return {
        ok: false,
        reason: "Bar staff can only update drink items.",
      };
    }
    return { ok: true };
  }

  return {
    ok: false,
    reason: "Your role cannot change product availability.",
  };
}

export async function loadProductForAvailability(
  admin: SupabaseClient,
  productId: string
): Promise<ProductAvailabilityRow | null> {
  const { data } = await admin
    .from("products")
    .select(
      "id, name, is_available, location_id, categories(menu_section)"
    )
    .eq("id", productId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data) return null;

  const row = data as unknown as {
    id: string;
    name: string;
    is_available: boolean;
    location_id: string;
    categories: { menu_section: string | null } | { menu_section: string | null }[] | null;
  };

  const category = Array.isArray(row.categories)
    ? row.categories[0] ?? null
    : row.categories;

  return {
    id: row.id,
    name: row.name,
    is_available: row.is_available,
    location_id: row.location_id,
    menu_section: category?.menu_section ?? null,
  };
}

export async function setProductAvailabilityTx(
  admin: SupabaseClient,
  input: {
    product: ProductAvailabilityRow;
    available: boolean;
    orgId: string;
    staffUserId: string;
    request?: NextRequest;
  }
): Promise<{ ok: true; changed: boolean } | { ok: false; error: string }> {
  if (input.product.is_available === input.available) {
    return { ok: true, changed: false };
  }

  const { error } = await admin
    .from("products")
    .update({ is_available: input.available })
    .eq("id", input.product.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  await auditLog({
    orgId: input.orgId,
    userId: input.staffUserId,
    action: "update",
    entityType: "product",
    entityId: input.product.id,
    oldValue: { is_available: input.product.is_available },
    newValue: { is_available: input.available },
    request: input.request,
  });

  void invalidateMenuCache(input.product.location_id);
  void invalidateGuestMenuCacheForLocation(input.product.location_id);

  if (!input.available) {
    await notifyAffectedSessionsOnEightySix(admin, {
      productId: input.product.id,
      productName: input.product.name,
      locationId: input.product.location_id,
    });
  }

  return { ok: true, changed: true };
}

async function notifyAffectedSessionsOnEightySix(
  admin: SupabaseClient,
  input: {
    productId: string;
    productName: string;
    locationId: string;
  }
): Promise<void> {
  const { data: unavailableRows } = await admin
    .from("products")
    .select("id")
    .eq("location_id", input.locationId)
    .eq("is_available", false)
    .is("deleted_at", null);

  const unavailableProductIds = (unavailableRows ?? []).map(
    (row) => (row as { id: string }).id
  );

  const substitutionMessage = await resolveInventorySubstitutionMessage({
    locationId: input.locationId,
    productId: input.productId,
    productName: input.productName,
    unavailableProductIds,
  });

  const { data: orderRows } = await admin
    .from("order_items")
    .select(
      "order_id, orders!inner(id, order_number, status, session_id, location_id, tables!inner(id, qr_token))"
    )
    .eq("product_id", input.productId)
    .eq("orders.location_id", input.locationId)
    .in("orders.status", [...PENDING_ORDER_STATUSES]);

  const seenSessions = new Set<string>();

  for (const row of orderRows ?? []) {
    const raw = row as unknown as {
      orders: {
        id: string;
        order_number: number;
        status: string;
        session_id: string | null;
        location_id: string;
        tables: { id: string; qr_token: string } | { id: string; qr_token: string }[];
      };
    };
    const orderRaw = raw.orders;
    const tables = Array.isArray(orderRaw.tables)
      ? orderRaw.tables[0]
      : orderRaw.tables;
    if (!tables) continue;

    const order = { ...orderRaw, tables };

    if (!order.session_id || seenSessions.has(order.session_id)) continue;
    seenSessions.add(order.session_id);

    scheduleProductUnavailableTell({
      orderId: order.id,
      sessionId: order.session_id,
      locationId: order.location_id,
      tableId: order.tables.id,
      tableToken: order.tables.qr_token,
      orderNumber: order.order_number,
      productId: input.productId,
      productName: input.productName,
      message:
        substitutionMessage ??
        `${input.productName} više nije dostupan. Javite osoblju za zamenu.`,
    });
  }
}

export async function loadEightySixEventsForRange(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    from: string;
    to: string;
  }
): Promise<EightySixEvent[]> {
  const { data: productRows } = await admin
    .from("products")
    .select("id, name")
    .eq("location_id", input.locationId)
    .is("deleted_at", null);

  const productNames = new Map(
    (productRows ?? []).map((row) => {
      const product = row as { id: string; name: string };
      return [product.id, product.name];
    })
  );

  if (productNames.size === 0) return [];

  const { data: auditRows } = await admin
    .from("audit_log")
    .select("entity_id, created_at, new_value, user_id")
    .eq("org_id", input.orgId)
    .eq("entity_type", "product")
    .eq("action", "update")
    .gte("created_at", input.from)
    .lt("created_at", input.to)
    .in("entity_id", [...productNames.keys()])
    .order("created_at", { ascending: true });

  const events: EightySixEvent[] = [];

  for (const row of auditRows ?? []) {
    const audit = row as {
      entity_id: string | null;
      created_at: string;
      new_value: { is_available?: boolean } | null;
      user_id: string | null;
    };
    if (!audit.entity_id || audit.new_value?.is_available !== false) continue;

    events.push({
      productId: audit.entity_id,
      productName: productNames.get(audit.entity_id) ?? "Artikal",
      at: audit.created_at,
      staffUserId: audit.user_id,
    });
  }

  return events;
}

export async function loadTodayEightySixItems(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    from: string;
    to: string;
    station?: "kitchen" | "bar";
  }
): Promise<TodayEightySixItem[]> {
  const events = await loadEightySixEventsForRange(admin, {
    orgId: input.orgId,
    locationId: input.locationId,
    from: input.from,
    to: input.to,
  });

  const lastEightySixAt = new Map<string, string>();
  for (const event of events) {
    lastEightySixAt.set(event.productId, event.at);
  }

  if (lastEightySixAt.size === 0) return [];

  const { data: products } = await admin
    .from("products")
    .select("id, name, is_available, categories(menu_section)")
    .eq("location_id", input.locationId)
    .in("id", [...lastEightySixAt.keys()])
    .is("deleted_at", null);

  return (products ?? [])
    .map((row) => {
      const product = row as unknown as {
        id: string;
        name: string;
        is_available: boolean;
        categories: { menu_section: string | null } | { menu_section: string | null }[] | null;
      };
      const category = Array.isArray(product.categories)
        ? product.categories[0] ?? null
        : product.categories;
      const menuSection = category?.menu_section ?? null;
      return {
        productId: product.id,
        productName: product.name,
        menuSection,
        eightySixedAt: lastEightySixAt.get(product.id) ?? null,
        isAvailable: product.is_available,
      };
    })
    .filter((item) => {
      if (input.station === "kitchen") {
        return isKitchenMenuSection(item.menuSection);
      }
      if (input.station === "bar") {
        return isDrinksMenuSection(item.menuSection);
      }
      return true;
    })
    .sort((a, b) => {
      const aTime = a.eightySixedAt ? Date.parse(a.eightySixedAt) : 0;
      const bTime = b.eightySixedAt ? Date.parse(b.eightySixedAt) : 0;
      return bTime - aTime;
    });
}

export function buildEightySixDigestLines(
  events: EightySixEvent[],
  timezone = "Europe/Berlin"
): string[] {
  if (!events.length) return [];

  const formatter = new Intl.DateTimeFormat("sr-RS", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  });

  return events.map(
    (event) =>
      `${formatter.format(new Date(event.at))} — ${event.productName}`
  );
}

import type { OrderWithDetails, Table, Zone } from "@/types";
import type { Order, OrderItem, OrderItemModifier } from "@/types";

export const ORDER_WITH_DETAILS_SELECT =
  "*, order_items(*, order_item_modifiers(*)), tables(name, zone:zones(name))" as const;

export const TABLE_WITH_ZONE_SELECT = "*, zone:zones(*)" as const;

export const STAFF_TABLE_WITH_ZONE_SELECT =
  "id, name, location_id, zone_id, zone:zones(name)" as const;

export const WAITER_DETAIL_ORDER_SELECT =
  "id, order_number, status, total, created_at, order_items(*, order_item_modifiers(*))" as const;

export const WAITER_ORDERS_LIST_SELECT =
  "id, order_number, status, total, created_at, table_id, order_items(*, order_item_modifiers(*)), tables(name)" as const;

export const WAITER_SUMMARY_ORDER_SELECT =
  "id, table_id, session_id, order_number, total, status, created_at, payment_requested_at, payment_status, payment_method" as const;

export const WAITER_CALL_TABLE_SELECT = "id, name, zone:zones(name)" as const;

export type WaiterCallTableRow = Pick<Table, "id" | "name"> & {
  zone: Pick<Zone, "name"> | null;
};

/** Row shape returned by {@link ORDER_WITH_DETAILS_SELECT}. */
export type OrderWithDetailsQueryRow = Order & {
  order_items: (OrderItem & {
    order_item_modifiers: OrderItemModifier[];
  })[];
  tables: { name: string; zone: { name: string } | null } | null;
};

/** Row shape returned by {@link TABLE_WITH_ZONE_SELECT}. */
export type TableWithZoneQueryRow = Table & { zone: Zone | null };

/** Row shape returned by {@link STAFF_TABLE_WITH_ZONE_SELECT}. */
export type StaffTableWithZoneQueryRow = Pick<
  Table,
  "id" | "name" | "location_id" | "zone_id"
> & {
  zone: Pick<Zone, "name"> | null;
};

export function orderWithDetailsRows(data: unknown): OrderWithDetails[] {
  return (data ?? []) as OrderWithDetails[];
}

export function parseOrderWithDetails(data: unknown): OrderWithDetails {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid order row");
  }
  return data as OrderWithDetails;
}

export function tableWithZoneRows(
  data: unknown
): Array<Table & { zone: Zone | null }> {
  return (data ?? []) as Array<Table & { zone: Zone | null }>;
}

export type DashboardTableStatusRow = {
  id: string;
  name: string;
  zone_id: string | null;
  zone: { id: string; name: string } | null;
};

export function parseWaiterCallTableRows(data: unknown): WaiterCallTableRow[] {
  if (!Array.isArray(data)) return [];
  return data as WaiterCallTableRow[];
}

export function parseDashboardTableStatusRows(
  data: unknown
): DashboardTableStatusRow[] {
  if (!Array.isArray(data)) return [];
  return data as DashboardTableStatusRow[];
}

export function staffTableWithZoneRows(data: unknown): StaffTableWithZoneQueryRow[] {
  return (data ?? []) as StaffTableWithZoneQueryRow[];
}

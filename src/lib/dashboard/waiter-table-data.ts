import type { Order, Table, TableSession, Zone } from "@/types";
import {
  isActiveTableOrder,
  orderHasPaymentRequest,
} from "@/lib/dashboard/table-active-orders";

export type WaiterTableOrder = Pick<
  Order,
  | "id"
  | "order_number"
  | "total"
  | "status"
  | "created_at"
  | "payment_requested_at"
  | "payment_status"
  | "payment_method"
>;

export type WaiterTableRow = Table & {
  zone: Zone | null;
  session: Pick<TableSession, "id" | "opened_at"> | null;
  activeOrders: WaiterTableOrder[];
  sessionTotal: number;
  hasWaiterCall: boolean;
  hasPaymentRequest: boolean;
};

export type WaiterTableVisualStatus =
  | "free"
  | "active"
  | "ready"
  | "call"
  | "pending_approval";

export function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function getWaiterTableVisualStatus(
  table: WaiterTableRow
): WaiterTableVisualStatus {
  if (table.hasWaiterCall) return "call";
  if (table.activeOrders.some((order) => order.status === "pending_approval")) {
    return "pending_approval";
  }
  if (table.activeOrders.some((order) => order.status === "ready")) {
    return "ready";
  }
  if (
    table.activeOrders.some((order) =>
      ["accepted", "preparing", "pending"].includes(order.status)
    )
  ) {
    return "active";
  }
  return "free";
}

export function waiterTableSortPriority(table: WaiterTableRow): number {
  const status = getWaiterTableVisualStatus(table);
  switch (status) {
    case "call":
      return 0;
    case "ready":
      return 1;
    case "pending_approval":
      return 2;
    case "active":
      return 3;
    default:
      return 4;
  }
}

export function sortWaiterTables(tables: WaiterTableRow[]): WaiterTableRow[] {
  return [...tables].sort((a, b) => {
    const priorityDiff =
      waiterTableSortPriority(a) - waiterTableSortPriority(b);
    if (priorityDiff !== 0) return priorityDiff;
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });
}

export function getLastOrderAt(table: WaiterTableRow): string | null {
  if (table.activeOrders.length === 0) return null;

  return table.activeOrders.reduce<string | null>((latest, order) => {
    if (!latest) return order.created_at;
    return new Date(order.created_at) > new Date(latest)
      ? order.created_at
      : latest;
  }, null);
}

export function buildWaiterTableRows(
  tablesData: Array<Table & { zone: Zone | null }>,
  sessions: Array<Pick<TableSession, "id" | "table_id" | "opened_at">>,
  orders: Array<
    WaiterTableOrder & {
      table_id: string | null;
      session_id: string | null;
    }
  >,
  pendingCallTableIds: Set<string>
): WaiterTableRow[] {
  const sessionMap = new Map(
    sessions.map((s) => [s.table_id, { id: s.id, opened_at: s.opened_at }])
  );

  const ordersByTable = new Map<string, WaiterTableOrder[]>();
  for (const row of orders) {
    if (!row.table_id) continue;

    const session = sessionMap.get(row.table_id) ?? null;
    if (!isActiveTableOrder(row, session)) continue;

    const list = ordersByTable.get(row.table_id) ?? [];
    list.push(row);
    ordersByTable.set(row.table_id, list);
  }

  return tablesData.map((table) => {
    const session = sessionMap.get(table.id) ?? null;
    const activeOrders = ordersByTable.get(table.id) ?? [];
    const sessionTotal = activeOrders.reduce(
      (sum, order) => sum + Number(order.total),
      0
    );
    const hasPaymentRequest = activeOrders.some((order) =>
      orderHasPaymentRequest(order)
    );

    return {
      ...table,
      session,
      activeOrders,
      sessionTotal,
      hasWaiterCall: pendingCallTableIds.has(table.id),
      hasPaymentRequest,
    };
  });
}

export const WAITER_TABLE_STATUS_STYLES: Record<
  WaiterTableVisualStatus,
  {
    dot: string;
    border: string;
    label: string;
  }
> = {
  free: {
    dot: "bg-emerald-500",
    border: "border-dashed border-emerald-500/30 bg-dash-bg/50",
    label: "Slobodan",
  },
  active: {
    dot: "bg-yellow-400",
    border: "border-yellow-500/50 ring-1 ring-yellow-500/20",
    label: "Aktivno",
  },
  ready: {
    dot: "bg-orange-500",
    border: "border-orange-500/60 ring-1 ring-orange-500/25",
    label: "Spremno",
  },
  call: {
    dot: "bg-red-500",
    border: "animate-pulse border-red-500 ring-1 ring-red-500/30",
    label: "Poziv",
  },
  pending_approval: {
    dot: "bg-blue-500",
    border: "border-blue-500/60 ring-1 ring-blue-500/25",
    label: "Odobrenje",
  },
};

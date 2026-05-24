import type { Order, Table, TableSession, Zone } from "@/types";

export type WaiterTableOrder = Pick<
  Order,
  | "id"
  | "order_number"
  | "total"
  | "status"
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

export type WaiterTableStatus = "available" | "occupied" | "attention" | "payment";

export function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function waiterTableStatus(table: WaiterTableRow): WaiterTableStatus {
  if (table.hasWaiterCall) return "attention";
  if (table.hasPaymentRequest) return "payment";
  if (table.session || table.activeOrders.length > 0) return "occupied";
  return "available";
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

    const session = sessionMap.get(row.table_id);
    if (session) {
      if (row.session_id !== session.id) continue;
    } else if (
      !["pending", "accepted", "preparing", "ready"].includes(row.status)
    ) {
      continue;
    }

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
    const hasPaymentRequest = activeOrders.some(
      (order) =>
        order.payment_status !== "paid" &&
        Boolean(order.payment_requested_at) &&
        order.payment_method !== "unset"
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

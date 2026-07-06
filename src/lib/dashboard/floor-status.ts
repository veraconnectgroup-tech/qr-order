import {
  isActiveTableOrder,
  orderHasPaymentRequest,
} from "@/lib/dashboard/table-active-orders";

export type FloorViewStatus = "free" | "ordering" | "waiting" | "problem";

export type FloorTableOrder = {
  status: string;
  payment_requested_at?: string | null;
  payment_status: string;
  payment_method?: string;
  created_at?: string;
  session_id?: string | null;
  table_id?: string | null;
  total?: number | string;
};

export type FloorTableRow = {
  id: string;
  name: string;
  zoneId?: string | null;
  zoneName?: string | null;
  status: FloorViewStatus;
  sessionId?: string | null;
  sessionOpenedAt?: string | null;
  sessionTotal?: number;
  aiSessionId?: string | null;
  activeOrders: FloorTableOrder[];
  hasWaiterCall: boolean;
};

const STALE_ORDER_MS = 20 * 60 * 1000;

export function deriveFloorViewStatus(input: {
  hasWaiterCall: boolean;
  session: { id: string } | null;
  activeOrders: FloorTableOrder[];
  nowMs?: number;
}): FloorViewStatus {
  const { hasWaiterCall, session, activeOrders } = input;
  const nowMs = input.nowMs ?? Date.now();

  if (hasWaiterCall) return "problem";

  const orders = activeOrders;
  if (orders.some((order) => orderHasPaymentRequest(order))) return "problem";
  if (orders.some((order) => order.status === "rejected")) return "problem";

  for (const order of orders) {
    if (!order.created_at) continue;
    const age = nowMs - new Date(order.created_at).getTime();
    if (
      age > STALE_ORDER_MS &&
      ["pending", "accepted", "preparing"].includes(order.status)
    ) {
      return "problem";
    }
  }

  if (
    orders.some(
      (order) =>
        order.status === "pending" || order.status === "pending_approval"
    )
  ) {
    return "ordering";
  }

  if (
    orders.some((order) =>
      ["accepted", "preparing", "ready"].includes(order.status)
    )
  ) {
    return "waiting";
  }

  if (session || orders.length > 0) return "ordering";

  return "free";
}

export function buildFloorTableRows(input: {
  tables: Array<{
    id: string;
    name: string;
    zone_id?: string | null;
    zone?: { id: string; name: string } | null;
  }>;
  sessions: Array<{ id: string; table_id: string; opened_at: string }>;
  orders: FloorTableOrder[];
  waiterCallTableIds: Set<string>;
  aiSessionsByTable: Map<string, string>;
  nowMs?: number;
}): FloorTableRow[] {
  const sessionByTable = new Map(
    input.sessions.map((session) => [session.table_id, session])
  );

  const ordersByTable = new Map<string, FloorTableOrder[]>();
  const sessionTotals = new Map<string, number>();

  for (const order of input.orders) {
    const tableId = order.table_id;
    const sessionId = order.session_id;
    const session = sessionId
      ? input.sessions.find((row) => row.id === sessionId)
      : null;

    const resolvedTableId = tableId ?? session?.table_id;
    if (!resolvedTableId) continue;

    const bucket = ordersByTable.get(resolvedTableId) ?? [];
    bucket.push(order);
    ordersByTable.set(resolvedTableId, bucket);

    if (sessionId && order.payment_status !== "paid") {
      sessionTotals.set(
        sessionId,
        (sessionTotals.get(sessionId) ?? 0) + Number(order.total ?? 0)
      );
    }
  }

  return input.tables.map((table) => {
    const session = sessionByTable.get(table.id) ?? null;
    const rawOrders = ordersByTable.get(table.id) ?? [];
    const activeOrders = rawOrders.filter((order) =>
      isActiveTableOrder(
        {
          ...order,
          session_id: order.session_id ?? session?.id ?? null,
        },
        session
      )
    );

    const status = deriveFloorViewStatus({
      hasWaiterCall: input.waiterCallTableIds.has(table.id),
      session,
      activeOrders,
      nowMs: input.nowMs,
    });

    return {
      id: table.id,
      name: table.name,
      zoneId: table.zone_id ?? table.zone?.id ?? null,
      zoneName: table.zone?.name ?? null,
      status,
      sessionId: session?.id ?? null,
      sessionOpenedAt: session?.opened_at ?? null,
      sessionTotal: session ? sessionTotals.get(session.id) ?? 0 : undefined,
      aiSessionId: input.aiSessionsByTable.get(table.id) ?? null,
      activeOrders,
      hasWaiterCall: input.waiterCallTableIds.has(table.id),
    };
  });
}

export const floorViewStatusLabel: Record<FloorViewStatus, string> = {
  free: "Available",
  ordering: "Ordering",
  waiting: "Waiting",
  problem: "Needs attention",
};

/** Lowercase summary copy for overview stats row. */
export const floorViewStatusCountLabel: Record<FloorViewStatus, string> = {
  free: "free",
  ordering: "ordering",
  waiting: "waiting",
  problem: "problem",
};

export const floorViewStatuses: FloorViewStatus[] = [
  "free",
  "ordering",
  "waiting",
  "problem",
];

export const floorViewStatusColor: Record<
  FloorViewStatus,
  { border: string; dot: string; text: string }
> = {
  free: {
    border: "border-emerald-500/50 ring-emerald-500/20",
    dot: "bg-emerald-500",
    text: "text-emerald-400",
  },
  ordering: {
    border: "border-sky-500/50 ring-sky-500/25",
    dot: "bg-sky-500",
    text: "text-sky-400",
  },
  waiting: {
    border: "border-amber-500/50 ring-amber-500/25",
    dot: "bg-amber-500",
    text: "text-amber-400",
  },
  problem: {
    border: "border-red-500/60 ring-red-500/30 animate-pulse",
    dot: "bg-red-500",
    text: "text-red-400",
  },
};

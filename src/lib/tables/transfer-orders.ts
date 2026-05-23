import { findOrCreateTableSession } from "@/lib/sessions/find-or-create-table-session";
import { logger } from "@/lib/logger";
import { sanitizeOrderNotes } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";

export type TransferOrdersInput = {
  fromTableId: string;
  toTableId: string;
  orderIds: string[];
  staffId: string;
  locationId: string;
  note?: string;
};

export type TransferOrdersResult = {
  transferred: number;
  orderIds: string[];
  toTableName: string;
  toSessionId: string;
};

const ACTIVE_ORDER_FILTER = '("rejected","cancelled")';

export async function transferOrders(
  input: TransferOrdersInput
): Promise<
  { data: TransferOrdersResult } | { error: string; status: number }
> {
  const { fromTableId, toTableId, staffId, locationId } = input;
  const note = input.note ? sanitizeOrderNotes(input.note) : null;

  if (fromTableId === toTableId) {
    return { error: "Source and destination table must differ.", status: 400 };
  }

  const admin = createAdminClient();

  const [{ data: fromTable }, { data: toTable }] = await Promise.all([
    admin
      .from("tables")
      .select("id, name, location_id")
      .eq("id", fromTableId)
      .eq("location_id", locationId)
      .is("deleted_at", null)
      .maybeSingle(),
    admin
      .from("tables")
      .select("id, name, location_id")
      .eq("id", toTableId)
      .eq("location_id", locationId)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);

  if (!fromTable) {
    return { error: "Source table not found.", status: 404 };
  }

  if (!toTable) {
    return { error: "Destination table not found.", status: 404 };
  }

  const transferType = input.orderIds.length === 0 ? "full" : "partial";

  let orderIds = input.orderIds;

  if (orderIds.length === 0) {
    const { data: activeOrders, error: loadError } = await admin
      .from("orders")
      .select("id")
      .eq("location_id", locationId)
      .eq("table_id", fromTableId)
      .not("status", "in", ACTIVE_ORDER_FILTER);

    if (loadError) {
      return { error: "Orders could not be loaded.", status: 500 };
    }

    orderIds = ((activeOrders ?? []) as Array<{ id: string }>).map((o) => o.id);

    if (orderIds.length === 0) {
      return { error: "No active orders to transfer.", status: 400 };
    }
  }

  const { data: orders, error: ordersError } = await admin
    .from("orders")
    .select("id, table_id, session_id, status")
    .eq("location_id", locationId)
    .in("id", orderIds);

  if (ordersError) {
    return { error: "Orders could not be validated.", status: 500 };
  }

  const rows = (orders ?? []) as Array<{
    id: string;
    table_id: string | null;
    session_id: string | null;
    status: string;
  }>;

  if (rows.length !== orderIds.length) {
    return { error: "One or more orders were not found.", status: 404 };
  }

  for (const order of rows) {
    if (order.table_id !== fromTableId) {
      return {
        error: "All orders must belong to the source table.",
        status: 400,
      };
    }
    if (order.status === "rejected" || order.status === "cancelled") {
      return {
        error: "Rejected or cancelled orders cannot be transferred.",
        status: 400,
      };
    }
  }

  const { data: fromSession } = await admin
    .from("table_sessions")
    .select("id")
    .eq("table_id", fromTableId)
    .eq("location_id", locationId)
    .eq("status", "active")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const fromSessionId =
    (fromSession as { id: string } | null)?.id ??
    rows.find((o) => o.session_id)?.session_id ??
    null;

  const sessionResult = await findOrCreateTableSession(
    admin,
    toTableId,
    locationId
  );

  if ("error" in sessionResult) {
    return { error: sessionResult.error, status: sessionResult.status };
  }

  const toSessionId = sessionResult.sessionId;

  const { error: updateError } = await admin
    .from("orders")
    .update({
      table_id: toTableId,
      session_id: toSessionId,
    })
    .in("id", orderIds);

  if (updateError) {
    return { error: "Orders could not be transferred.", status: 500 };
  }

  const { error: auditError } = await admin.from("table_transfers").insert({
    location_id: locationId,
    from_table_id: fromTableId,
    to_table_id: toTableId,
    from_session_id: fromSessionId,
    to_session_id: toSessionId,
    transferred_by: staffId,
    transfer_type: transferType,
    order_ids: orderIds,
    note,
  });

  if (auditError) {
    logger.error("Table transfer audit insert failed", {
      fromTableId,
      toTableId,
      orderIds,
      error: auditError.message,
    });
    return { error: "Transfer audit could not be saved.", status: 500 };
  }

  if (transferType === "full" && fromSessionId) {
    const { count, error: countError } = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("location_id", locationId)
      .eq("table_id", fromTableId)
      .not("status", "in", ACTIVE_ORDER_FILTER);

    if (!countError && (count ?? 0) === 0) {
      await admin
        .from("table_sessions")
        .update({
          status: "closed",
          closed_at: new Date().toISOString(),
        })
        .eq("id", fromSessionId)
        .eq("status", "active");
    }
  }

  const toTableName = (toTable as { name: string }).name;

  logger.info("Table transfer completed", {
    fromTableId,
    toTableId,
    transferType,
    transferred: orderIds.length,
    staffId,
    locationId,
  });

  return {
    data: {
      transferred: orderIds.length,
      orderIds,
      toTableName,
      toSessionId,
    },
  };
}

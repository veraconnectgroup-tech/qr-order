"use server";

import { getStaffLocationId, requireStaff } from "@/lib/auth/session";
import { dispatchStaffNotification } from "@/lib/denis/notifications/dispatch-staff-notification";
import { stationLabel } from "@/lib/dashboard/operations-triage";
import { createAdminClient } from "@/lib/supabase/admin";

export async function remindWaiterForReadyStationAction(input: {
  orderId: string;
  station: "kitchen" | "bar";
}): Promise<{ success: true } | { error: string }> {
  const staff = await requireStaff();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return { error: "No location assigned." };
  }

  const admin = createAdminClient();
  const { data: orderRow, error } = await admin
    .from("orders")
    .select("id, order_number, location_id, table_id")
    .eq("id", input.orderId)
    .maybeSingle();

  if (error || !orderRow) {
    return { error: "Order not found." };
  }

  const order = orderRow as {
    id: string;
    order_number: number | null;
    location_id: string;
    table_id: string | null;
  };

  if (order.location_id !== locationId) {
    return { error: "Unauthorized." };
  }

  let tableName: string | null = null;
  if (order.table_id) {
    const { data: tableRow } = await admin
      .from("tables")
      .select("name")
      .eq("id", order.table_id)
      .maybeSingle();
    tableName = (tableRow as { name: string } | null)?.name ?? null;
  }
  const tableLabel = tableName ? `Sto ${tableName}` : "Sto";
  const bon =
    order.order_number != null ? `Bon #${order.order_number}` : "Bon";
  const station = stationLabel(input.station);

  await dispatchStaffNotification({
    orgId: staff.org_id,
    locationId,
    type: "long_wait",
    tableId: order.table_id ?? undefined,
    tableName: tableName ?? undefined,
    message: `${tableLabel} · ${bon} — ${station.toLowerCase()} spremno, preuzmite.`,
    playSound: true,
  });

  return { success: true };
}

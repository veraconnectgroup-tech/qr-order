import { findOrCreateTableSession } from "@/lib/sessions/find-or-create-table-session";
import { closeTableSession } from "@/lib/sessions/session-devices";
import { logger } from "@/lib/logger";
import { scheduleTableTransferGuestNotification } from "@/lib/scene/schedule-table-transfer-scene-refresh";
import { createAdminClient } from "@/lib/supabase/admin";
import { transferOrders, type TransferOrdersInput } from "@/lib/tables/transfer-orders";

export type MergeTableSessionsInput = {
  locationId: string;
  staffId: string;
  primaryTableId: string;
  secondaryTableId: string;
  note?: string;
};

export type MergeTableSessionsResult = {
  transferred: number;
  orderIds: string[];
  toTableName: string;
  toSessionId: string;
};

/** Merge two active table sessions onto the primary table — unified bill (Prompt 88). */
export async function mergeTableSessions(
  input: MergeTableSessionsInput
): Promise<
  { data: MergeTableSessionsResult } | { error: string; status: number }
> {
  if (input.primaryTableId === input.secondaryTableId) {
    return { error: "Primary and secondary table must differ.", status: 400 };
  }

  const transferInput: TransferOrdersInput = {
    fromTableId: input.secondaryTableId,
    toTableId: input.primaryTableId,
    orderIds: [],
    staffId: input.staffId,
    locationId: input.locationId,
    note: input.note ?? "merge: secondary session unified onto primary table",
  };

  const result = await transferOrders(transferInput);
  if ("error" in result) return result;

  logger.info("Table sessions merged", {
    primaryTableId: input.primaryTableId,
    secondaryTableId: input.secondaryTableId,
    transferred: result.data.transferred,
    locationId: input.locationId,
  });

  return { data: result.data };
}

export type SplitTableSessionInput = {
  locationId: string;
  staffId: string;
  tableId: string;
  orderIds: string[];
  targetTableId?: string;
  note?: string;
};

export type SplitTableSessionResult = {
  transferred: number;
  orderIds: string[];
  fromSessionId: string;
  toSessionId: string;
  toTableName: string;
};

const ACTIVE_ORDER_FILTER = '("rejected","cancelled")';

/** Split a group into a separate session / bill (Prompt 88). */
export async function splitTableSession(
  input: SplitTableSessionInput
): Promise<
  { data: SplitTableSessionResult } | { error: string; status: number }
> {
  const orderIds = input.orderIds.filter(Boolean);
  if (orderIds.length === 0) {
    return { error: "Select at least one order to split.", status: 400 };
  }

  const admin = createAdminClient();
  const targetTableId = input.targetTableId ?? input.tableId;

  const { data: fromSession } = await admin
    .from("table_sessions")
    .select("id")
    .eq("table_id", input.tableId)
    .eq("location_id", input.locationId)
    .eq("status", "active")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const fromSessionId = (fromSession as { id: string } | null)?.id ?? null;
  if (!fromSessionId) {
    return { error: "No active session on source table.", status: 400 };
  }

  let toSessionId: string;
  let toTableName: string;

  if (targetTableId === input.tableId) {
    const { data: tableRow } = await admin
      .from("tables")
      .select("name")
      .eq("id", targetTableId)
      .eq("location_id", input.locationId)
      .maybeSingle();

    toTableName = (tableRow as { name: string } | null)?.name ?? targetTableId;

    const { data: inserted, error: insertError } = await admin
      .from("table_sessions")
      .insert({
        table_id: targetTableId,
        location_id: input.locationId,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      return { error: "Split session could not be created.", status: 500 };
    }

    toSessionId = (inserted as { id: string }).id;
  } else {
    const sessionResult = await findOrCreateTableSession(
      admin,
      targetTableId,
      input.locationId
    );
    if ("error" in sessionResult) {
      return { error: sessionResult.error, status: sessionResult.status };
    }
    toSessionId = sessionResult.sessionId;

    const { data: tableRow } = await admin
      .from("tables")
      .select("name")
      .eq("id", targetTableId)
      .eq("location_id", input.locationId)
      .maybeSingle();
    toTableName = (tableRow as { name: string } | null)?.name ?? targetTableId;
  }

  const { data: splitOrders } = await admin
    .from("orders")
    .select("device_fingerprint")
    .eq("location_id", input.locationId)
    .in("id", orderIds);

  const fingerprints = new Set(
    ((splitOrders ?? []) as Array<{ device_fingerprint: string | null }>)
      .map((row) => row.device_fingerprint?.trim())
      .filter((value): value is string => Boolean(value))
  );

  const transferResult = await transferOrders({
    fromTableId: input.tableId,
    toTableId: targetTableId,
    orderIds,
    staffId: input.staffId,
    locationId: input.locationId,
    note: input.note ?? "split: separate bill for subset of party",
    toSessionId,
    guestNotifyKind: "none",
  });

  if ("error" in transferResult) return transferResult;

  if (fingerprints.size > 0) {
    for (const fingerprint of fingerprints) {
      await admin
        .from("denis_party_devices" as never)
        .update({
          table_session_id: toSessionId,
          table_id: targetTableId,
        } as never)
        .eq("table_session_id", fromSessionId)
        .eq("device_fingerprint", fingerprint);
    }
  }

  const { count } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("location_id", input.locationId)
    .eq("table_id", input.tableId)
    .eq("session_id", fromSessionId)
    .not("status", "in", ACTIVE_ORDER_FILTER);

  if ((count ?? 0) === 0) {
    await closeTableSession(admin, fromSessionId);
  }

  await Promise.all([
    scheduleTableTransferGuestNotification(admin, {
      tableSessionId: toSessionId,
      toTableName,
      kind: "split",
    }),
    scheduleTableTransferGuestNotification(admin, {
      tableSessionId: fromSessionId,
      toTableName,
      kind: "split",
    }),
  ]);

  return {
    data: {
      transferred: transferResult.data.transferred,
      orderIds: transferResult.data.orderIds,
      fromSessionId,
      toSessionId,
      toTableName,
    },
  };
}

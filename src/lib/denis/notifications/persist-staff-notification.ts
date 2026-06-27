import type { SupabaseClient } from "@supabase/supabase-js";
import type { StaffNotification } from "@/lib/denis/notifications/staff-notifications";

export type StaffNotificationRow = {
  id: string;
  orgId: string;
  locationId: string;
  type: string;
  priority: string;
  message: string;
  tableId: string | null;
  tableName: string | null;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

export async function persistStaffNotification(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    notification: StaffNotification;
  }
): Promise<StaffNotificationRow | null> {
  const { data, error } = await admin
    .from("denis_staff_notifications" as never)
    .insert({
      org_id: input.orgId,
      location_id: input.locationId,
      type: input.notification.type,
      priority: input.notification.priority,
      message: input.notification.message,
      table_id: input.notification.tableId ?? null,
      table_name: input.notification.tableName ?? null,
      action_url: input.notification.actionUrl ?? null,
    } as never)
    .select(
      "id, org_id, location_id, type, priority, message, table_id, table_name, action_url, read_at, created_at"
    )
    .single();

  if (error || !data) {
    return null;
  }

  const row = data as {
    id: string;
    org_id: string;
    location_id: string;
    type: string;
    priority: string;
    message: string;
    table_id: string | null;
    table_name: string | null;
    action_url: string | null;
    read_at: string | null;
    created_at: string;
  };

  return {
    id: row.id,
    orgId: row.org_id,
    locationId: row.location_id,
    type: row.type,
    priority: row.priority,
    message: row.message,
    tableId: row.table_id,
    tableName: row.table_name,
    actionUrl: row.action_url,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export async function loadStaffNotifications(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    limit?: number;
    unreadOnly?: boolean;
  }
): Promise<StaffNotificationRow[]> {
  let query = admin
    .from("denis_staff_notifications" as never)
    .select(
      "id, org_id, location_id, type, priority, message, table_id, table_name, action_url, read_at, created_at"
    )
    .eq("org_id", input.orgId)
    .eq("location_id", input.locationId)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 20);

  if (input.unreadOnly) {
    query = query.is("read_at", null);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const typed = row as {
      id: string;
      org_id: string;
      location_id: string;
      type: string;
      priority: string;
      message: string;
      table_id: string | null;
      table_name: string | null;
      action_url: string | null;
      read_at: string | null;
      created_at: string;
    };

    return {
      id: typed.id,
      orgId: typed.org_id,
      locationId: typed.location_id,
      type: typed.type,
      priority: typed.priority,
      message: typed.message,
      tableId: typed.table_id,
      tableName: typed.table_name,
      actionUrl: typed.action_url,
      readAt: typed.read_at,
      createdAt: typed.created_at,
    };
  });
}

export async function markStaffNotificationRead(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    notificationId: string;
  }
): Promise<boolean> {
  const { error } = await admin
    .from("denis_staff_notifications" as never)
    .update({ read_at: new Date().toISOString() } as never)
    .eq("id", input.notificationId)
    .eq("org_id", input.orgId)
    .eq("location_id", input.locationId)
    .is("read_at", null);

  return !error;
}

export async function markAllStaffNotificationsRead(
  admin: SupabaseClient,
  input: { orgId: string; locationId: string }
): Promise<number> {
  const { data, error } = await admin
    .from("denis_staff_notifications" as never)
    .update({ read_at: new Date().toISOString() } as never)
    .eq("org_id", input.orgId)
    .eq("location_id", input.locationId)
    .is("read_at", null)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).length;
}

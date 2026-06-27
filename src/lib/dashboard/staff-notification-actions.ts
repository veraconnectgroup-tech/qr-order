"use server";

import { revalidatePath } from "next/cache";
import { getStaffLocationId, requireStaff } from "@/lib/auth/session";
import {
  markAllStaffNotificationsRead,
  markStaffNotificationRead,
} from "@/lib/denis/notifications/persist-staff-notification";
import { createAdminClient } from "@/lib/supabase/admin";

export async function markStaffNotificationReadAction(notificationId: string) {
  const staff = await requireStaff();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return { error: "No location assigned." as const };
  }

  const admin = createAdminClient();
  const ok = await markStaffNotificationRead(admin, {
    orgId: staff.org_id,
    locationId,
    notificationId,
  });

  if (!ok) {
    return { error: "Could not mark notification read." as const };
  }

  revalidatePath("/dashboard");
  return { success: true as const };
}

export async function markAllStaffNotificationsReadAction() {
  const staff = await requireStaff();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return { error: "No location assigned." as const };
  }

  const admin = createAdminClient();
  const count = await markAllStaffNotificationsRead(admin, {
    orgId: staff.org_id,
    locationId,
  });

  revalidatePath("/dashboard");
  return { success: true as const, count };
}

"use server";

import { revalidatePath } from "next/cache";
import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import { markFeedbackInboxHandled } from "@/lib/feedback/feedback-inbox-store";
import { createAdminClient } from "@/lib/supabase/admin";

export async function markFeedbackHandledAction(id: string) {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return { error: "No location assigned." };
  }

  const admin = createAdminClient();
  const ok = await markFeedbackInboxHandled(admin, {
    id,
    locationId,
    staffId: staff.id,
  });

  if (!ok) {
    return { error: "Could not save." };
  }

  revalidatePath("/admin/feedback");
  return { success: true };
}

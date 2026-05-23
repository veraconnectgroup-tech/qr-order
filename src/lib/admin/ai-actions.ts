"use server";

import { revalidatePath } from "next/cache";
import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateLocationAiConciergeEnabled(enabled: boolean) {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);

  if (!locationId) {
    return { error: "Location not found." };
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("locations")
    .update({
      ai_concierge_enabled: enabled,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", locationId);

  if (error) return { error: error.message };

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return { success: true };
}

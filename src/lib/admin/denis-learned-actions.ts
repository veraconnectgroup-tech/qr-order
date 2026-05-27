"use server";

import { revalidatePath } from "next/cache";
import {
  promoteLearnedEdgeToUpsellRule,
  rejectLearnedEdge,
} from "@/lib/admin/denis-learned-edges";
import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function approveDenisLearnedEdge(edgeId: string) {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) return { error: "Location not found." };

  const admin = createAdminClient();
  const result = await promoteLearnedEdgeToUpsellRule(admin, {
    locationId,
    edgeId,
    staffId: staff.id,
  });

  if (result.error) return { error: result.error };

  revalidatePath("/admin/denis-insights");
  revalidatePath("/admin/upsells");
  return { success: true, upsellRuleId: result.upsellRuleId };
}

export async function rejectDenisLearnedEdge(edgeId: string) {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) return { error: "Location not found." };

  const admin = createAdminClient();
  const result = await rejectLearnedEdge(admin, {
    locationId,
    edgeId,
    staffId: staff.id,
  });

  if (result.error) return { error: result.error };

  revalidatePath("/admin/denis-insights");
  return { success: true };
}

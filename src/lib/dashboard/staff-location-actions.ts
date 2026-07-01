"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auditLog } from "@/lib/audit/log";
import { requireStaff } from "@/lib/auth/session";
import { setStaffLocations } from "@/lib/staff/staff-locations";
import { createAdminClient } from "@/lib/supabase/admin";
import { zUuid } from "@/lib/security/zod-fields";

const assignSchema = z.object({
  staffId: zUuid(),
  locationIds: z.array(zUuid()),
});

export async function assignStaffLocationsAction(input: {
  staffId: string;
  locationIds: string[];
}) {
  const staff = await requireStaff();
  if (!["owner", "manager"].includes(staff.role)) {
    return { error: "Unauthorized." };
  }

  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid staff location assignment." };
  }

  if (parsed.data.staffId === staff.id && parsed.data.locationIds.length === 0) {
    return { error: "You cannot remove yourself from all locations." };
  }

  const admin = createAdminClient();

  try {
    const result = await setStaffLocations(admin, {
      orgId: staff.org_id,
      staffId: parsed.data.staffId,
      locationIds: parsed.data.locationIds,
    });

    await auditLog({
      orgId: staff.org_id,
      userId: staff.user_id,
      action: "update",
      entityType: "staff_locations",
      entityId: parsed.data.staffId,
      newValue: {
        locationIds: parsed.data.locationIds,
        primaryLocationId: result.primaryLocationId,
      },
    });

    revalidatePath("/dashboard/staff");
    revalidatePath("/admin/staff");
    return { data: result };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Staff assignment failed.",
    };
  }
}

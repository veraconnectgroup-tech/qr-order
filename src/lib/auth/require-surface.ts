import { redirect } from "next/navigation";
import { getEffectiveStaff, type EffectiveStaff } from "@/lib/auth/session";
import { getStaffAccess } from "@/lib/auth/get-staff-access";
import { surfaceToPath, type StaffSurface } from "@/lib/auth/role-templates";
import type { StaffAccess } from "@/lib/auth/staff-access";

export async function requireSurface(
  surface: StaffSurface
): Promise<{ staff: EffectiveStaff; access: StaffAccess }> {
  const staff = await getEffectiveStaff();
  const access = await getStaffAccess(staff);

  if (!access.allowedSurfaces.includes(surface)) {
    redirect(surfaceToPath(access.primarySurface));
  }

  return { staff, access };
}

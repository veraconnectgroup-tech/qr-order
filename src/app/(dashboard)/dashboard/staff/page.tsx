import { StaffBoard } from "@/components/dashboard/staff-board";
import { getStaffAccess } from "@/lib/auth/get-staff-access";
import { loadStaffPermissionOverridesBatch } from "@/lib/auth/load-staff-permission-overrides";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function StaffPage() {
  const staff = await requireStaff();
  const actorAccess = await getStaffAccess(staff);
  const canManage = actorAccess.permissions.has("staff.manage");
  const admin = createAdminClient();

  const [{ data: team }, { data: invites }] = await Promise.all([
    admin
      .from("staff")
      .select("id, name, email, role, is_active")
      .eq("org_id", staff.org_id)
      .is("deleted_at", null)
      .order("created_at"),
    canManage
      ? admin
          .from("staff_invites")
          .select("id, email, name, role, expires_at, token")
          .eq("org_id", staff.org_id)
          .is("accepted_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const teamRows = (team ?? []) as Array<{
    id: string;
    name: string;
    email: string | null;
    role: string;
    is_active: boolean;
  }>;

  const overridesByStaffId = canManage
    ? await loadStaffPermissionOverridesBatch(
        admin,
        teamRows.map((member) => member.id)
      )
    : {};

  const actorGrantable =
    staff.role === "owner" ? null : actorAccess.permissions;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <StaffBoard
      staff={teamRows}
      invites={(
        (invites ?? []) as Array<{
          id: string;
          email: string;
          name: string;
          role: string;
          expires_at: string;
          token: string;
        }>
      ).map((invite) => ({
        id: invite.id,
        email: invite.email,
        name: invite.name,
        role: invite.role,
        expires_at: invite.expires_at,
        link: `${appUrl}/invite/${invite.token}`,
      }))}
      currentStaffId={staff.id}
      canManage={canManage}
      overridesByStaffId={overridesByStaffId}
      actorGrantable={actorGrantable}
    />
  );
}

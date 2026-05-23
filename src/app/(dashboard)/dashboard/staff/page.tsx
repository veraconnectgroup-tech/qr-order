import { StaffBoard } from "@/components/dashboard/staff-board";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function StaffPage() {
  const staff = await requireStaff();
  const canManage = ["owner", "manager"].includes(staff.role);
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <StaffBoard
      staff={(team ?? []) as Array<{
        id: string;
        name: string;
        email: string | null;
        role: string;
        is_active: boolean;
      }>}
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
    />
  );
}

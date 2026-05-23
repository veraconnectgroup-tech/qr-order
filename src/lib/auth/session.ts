import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Staff } from "@/types";

export async function getSession() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentStaff() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("staff")
    .select("*, organizations(id, name, slug, currency, default_tax_percent)")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  return data as
    | (Staff & {
        organizations: {
          id: string;
          name: string;
          slug: string;
          currency: string;
          default_tax_percent: number;
        } | null;
      })
    | null;
}

export async function requireStaff() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  return staff;
}

export async function requireAdmin() {
  const staff = await requireStaff();
  if (!["owner", "manager"].includes(staff.role)) {
    redirect("/dashboard");
  }
  return staff;
}

export async function getStaffLocationId(staff: Staff) {
  if (staff.location_id) return staff.location_id;

  const admin = createAdminClient();
  const { data } = await admin
    .from("locations")
    .select("id")
    .eq("org_id", staff.org_id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data?.id ?? null;
}

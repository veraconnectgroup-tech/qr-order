import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LOCATION_COOKIE_NAME } from "@/lib/auth/location-cookie";
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

export async function requireOwner() {
  const staff = await requireStaff();
  if (staff.role !== "owner") {
    redirect("/dashboard");
  }
  return staff;
}

export async function getStaffAccessibleLocationIds(staff: Staff) {
  const admin = createAdminClient();

  const { data: links } = await admin
    .from("staff_locations")
    .select("location_id, locations!inner(id, org_id, is_active)")
    .eq("staff_id", staff.id);

  const assignedIds = ((links ?? []) as Array<{
    location_id: string;
    locations: { id: string; org_id: string; is_active: boolean };
  }>)
    .filter(
      (row) =>
        row.locations.org_id === staff.org_id && row.locations.is_active
    )
    .map((row) => row.location_id);

  if (assignedIds.length > 0) {
    return [...new Set(assignedIds)];
  }

  if (staff.location_id) {
    const { data: location } = await admin
      .from("locations")
      .select("id")
      .eq("id", staff.location_id)
      .eq("org_id", staff.org_id)
      .eq("is_active", true)
      .maybeSingle();

    if (location) {
      return [(location as { id: string }).id];
    }
  }

  const { data: locations } = await admin
    .from("locations")
    .select("id")
    .eq("org_id", staff.org_id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  return ((locations ?? []) as Array<{ id: string }>).map((row) => row.id);
}

export async function getStaffAccessibleLocations(staff: Staff) {
  const ids = await getStaffAccessibleLocationIds(staff);
  if (!ids.length) return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from("locations")
    .select("id, name")
    .in("id", ids)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  return (data ?? []) as Array<{ id: string; name: string }>;
}

export async function getStaffLocationId(staff: Staff) {
  const accessible = await getStaffAccessibleLocationIds(staff);
  if (!accessible.length) return null;

  const cookieStore = await cookies();
  const cookieLocation = cookieStore.get(LOCATION_COOKIE_NAME)?.value;
  if (cookieLocation && accessible.includes(cookieLocation)) {
    return cookieLocation;
  }

  if (staff.location_id && accessible.includes(staff.location_id)) {
    return staff.location_id;
  }

  return accessible[0];
}

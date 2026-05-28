import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LOCATION_COOKIE_NAME } from "@/lib/auth/location-cookie";
import { IMPERSONATE_COOKIE } from "@/lib/platform/impersonation-cookie";
import type { Staff } from "@/types";

export type EffectiveStaff = Staff & {
  organizations: {
    id: string;
    name: string;
    slug: string;
    currency: string;
    default_tax_percent: number;
  } | null;
  impersonating?: boolean;
  impersonated_org_name?: string;
};

async function getImpersonatedOrgId() {
  const cookieStore = await cookies();
  return cookieStore.get(IMPERSONATE_COOKIE)?.value ?? null;
}

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
    .select(
      "*, organizations(id, name, slug, currency, default_tax_percent)"
    )
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

export async function requirePlatformAdmin() {
  const staff = await getCurrentStaff();
  if (!staff?.is_platform_admin) {
    redirect("/dashboard");
  }
  return staff;
}

export async function getEffectiveStaff(): Promise<EffectiveStaff> {
  const staff = await getCurrentStaff();
  if (!staff) {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    redirect(user ? "/login?error=no_access" : "/login");
  }

  const impersonatedOrgId = await getImpersonatedOrgId();
  if (!impersonatedOrgId || !staff.is_platform_admin) {
    return { ...staff, impersonating: false };
  }

  const admin = createAdminClient();
  const [{ data: org }, { data: owner }] = await Promise.all([
    admin
      .from("organizations")
      .select("id, name, slug, currency, default_tax_percent")
      .eq("id", impersonatedOrgId)
      .maybeSingle(),
    admin
      .from("staff")
      .select("*")
      .eq("org_id", impersonatedOrgId)
      .eq("role", "owner")
      .eq("is_active", true)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle(),
  ]);

  if (!org || !owner) {
    return { ...staff, impersonating: false };
  }

  const orgRow = org as {
    id: string;
    name: string;
    slug: string;
    currency: string;
    default_tax_percent: number;
  };

  return {
    ...(owner as Staff),
    organizations: orgRow,
    is_platform_admin: true,
    impersonating: true,
    impersonated_org_name: orgRow.name,
  };
}

export async function getStaffAccessibleLocationIds(staff: Staff) {
  const admin = createAdminClient();

  if (staff.role === "owner") {
    const { data: locations } = await admin
      .from("locations")
      .select("id")
      .eq("org_id", staff.org_id)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    return ((locations ?? []) as Array<{ id: string }>).map((row) => row.id);
  }

  const { data: links } = await admin
    .from("staff_locations")
    .select("location_id")
    .eq("staff_id", staff.id);

  const linkedIds = ((links ?? []) as Array<{ location_id: string }>).map(
    (row) => row.location_id
  );

  if (linkedIds.length > 0) {
    const { data: locations } = await admin
      .from("locations")
      .select("id")
      .in("id", linkedIds)
      .eq("org_id", staff.org_id)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    return ((locations ?? []) as Array<{ id: string }>).map((row) => row.id);
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

/** Single round-trip for layout: accessible locations + resolved active location. */
export async function getStaffLocationContext(staff: Staff) {
  const accessibleLocations = await getStaffAccessibleLocations(staff);
  const accessibleIds = accessibleLocations.map((row) => row.id);
  if (!accessibleIds.length) {
    return { locationId: null as string | null, accessibleLocations };
  }

  const cookieStore = await cookies();
  const cookieLocation = cookieStore.get(LOCATION_COOKIE_NAME)?.value;
  let locationId: string | null = null;

  if (cookieLocation && accessibleIds.includes(cookieLocation)) {
    locationId = cookieLocation;
  } else if (staff.location_id && accessibleIds.includes(staff.location_id)) {
    locationId = staff.location_id;
  } else {
    locationId = accessibleIds[0] ?? null;
  }

  return { locationId, accessibleLocations };
}

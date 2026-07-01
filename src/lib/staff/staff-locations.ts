import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadStaffLocationIds(
  admin: SupabaseClient,
  staffId: string
): Promise<string[]> {
  const [{ data: staffRow }, { data: junctionRows }] = await Promise.all([
    admin.from("staff").select("location_id").eq("id", staffId).maybeSingle(),
    admin
      .from("staff_locations")
      .select("location_id")
      .eq("staff_id", staffId),
  ]);

  const ids = new Set<string>();
  const primary = (staffRow as { location_id: string | null } | null)?.location_id;
  if (primary) ids.add(primary);

  for (const row of junctionRows ?? []) {
    ids.add((row as { location_id: string }).location_id);
  }

  return [...ids];
}

export async function loadStaffLocationsBatch(
  admin: SupabaseClient,
  staffIds: string[]
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (!staffIds.length) return result;

  const [{ data: staffRows }, { data: junctionRows }] = await Promise.all([
    admin.from("staff").select("id, location_id").in("id", staffIds),
    admin.from("staff_locations").select("staff_id, location_id").in("staff_id", staffIds),
  ]);

  for (const id of staffIds) {
    result.set(id, []);
  }

  for (const row of staffRows ?? []) {
    const s = row as { id: string; location_id: string | null };
    if (s.location_id) {
      const list = result.get(s.id) ?? [];
      if (!list.includes(s.location_id)) list.push(s.location_id);
      result.set(s.id, list);
    }
  }

  for (const row of junctionRows ?? []) {
    const sl = row as { staff_id: string; location_id: string };
    const list = result.get(sl.staff_id) ?? [];
    if (!list.includes(sl.location_id)) list.push(sl.location_id);
    result.set(sl.staff_id, list);
  }

  return result;
}

/** Replace floating staff location assignments (owner/manager only). */
export async function setStaffLocations(
  admin: SupabaseClient,
  input: {
    orgId: string;
    staffId: string;
    locationIds: string[];
  }
): Promise<{ primaryLocationId: string | null }> {
  const uniqueIds = [...new Set(input.locationIds)];

  if (uniqueIds.length) {
    const { data: locations } = await admin
      .from("locations")
      .select("id")
      .eq("org_id", input.orgId)
      .in("id", uniqueIds);

    const valid = new Set(
      (locations ?? []).map((row) => (row as { id: string }).id)
    );
    for (const id of uniqueIds) {
      if (!valid.has(id)) {
        throw new Error(`Location ${id} is not in this organization.`);
      }
    }
  }

  const { data: staffRow } = await admin
    .from("staff")
    .select("id, org_id")
    .eq("id", input.staffId)
    .maybeSingle();

  const staff = staffRow as { id: string; org_id: string } | null;
  if (!staff || staff.org_id !== input.orgId) {
    throw new Error("Staff member not found.");
  }

  await admin.from("staff_locations").delete().eq("staff_id", input.staffId);

  const primaryLocationId = uniqueIds[0] ?? null;

  await admin
    .from("staff")
    .update({ location_id: primaryLocationId } as never)
    .eq("id", input.staffId);

  if (uniqueIds.length) {
    const rows = uniqueIds.map((locationId) => ({
      staff_id: input.staffId,
      location_id: locationId,
    }));

    const { error } = await admin.from("staff_locations").insert(rows as never);
    if (error) {
      throw new Error(`Staff location assignment failed: ${error.message}`);
    }
  }

  return { primaryLocationId };
}

export function isFloatingStaff(locationIds: string[]): boolean {
  return locationIds.length > 1;
}

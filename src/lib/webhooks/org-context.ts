import { createAdminClient } from "@/lib/supabase/admin";

export async function orgIdForLocation(locationId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("locations")
    .select("org_id")
    .eq("id", locationId)
    .maybeSingle();

  return (data as { org_id: string } | null)?.org_id ?? null;
}

export async function orgIdForOrder(orderId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("orders")
    .select("location_id, locations(org_id)")
    .eq("id", orderId)
    .maybeSingle();

  const row = data as { locations: { org_id: string } | null } | null;
  return row?.locations?.org_id ?? null;
}

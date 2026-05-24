import { createAdminClient } from "@/lib/supabase/admin";

export async function resolveOrgIdFromTableToken(
  tableToken: string
): Promise<string | null> {
  const admin = createAdminClient();
  const { data: table } = await admin
    .from("tables")
    .select("location_id")
    .eq("qr_token", tableToken)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (!table) return null;

  const { data: location } = await admin
    .from("locations")
    .select("org_id")
    .eq("id", (table as { location_id: string }).location_id)
    .maybeSingle();

  return (location as { org_id: string } | null)?.org_id ?? null;
}

export async function resolveOrgIdFromOrderId(
  orderId: string
): Promise<string | null> {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("location_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return null;

  const { data: location } = await admin
    .from("locations")
    .select("org_id")
    .eq("id", (order as { location_id: string }).location_id)
    .maybeSingle();

  return (location as { org_id: string } | null)?.org_id ?? null;
}

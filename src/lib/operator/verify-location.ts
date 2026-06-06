import type { SupabaseClient } from "@supabase/supabase-js";

export async function verifyOperatorLocation(
  admin: SupabaseClient,
  orgId: string,
  locationId: string
): Promise<{ id: string; name: string; timezone: string } | null> {
  const { data, error } = await admin
    .from("locations")
    .select("id, name, timezone")
    .eq("id", locationId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as { id: string; name: string; timezone: string | null };
  return {
    id: row.id,
    name: row.name,
    timezone: row.timezone?.trim() || "Europe/Berlin",
  };
}

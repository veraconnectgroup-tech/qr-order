import type { SupabaseClient } from "@supabase/supabase-js";

const RETURNING_LOOKBACK_DAYS = 30;

export async function resolveSessionReturningGuest(
  admin: SupabaseClient,
  input: {
    locationId: string;
    sessionId: string;
    openedAt: string;
    guestToken?: string | null;
    guestDeviceId?: string | null;
  }
): Promise<boolean> {
  const guestToken = input.guestToken?.trim();
  if (guestToken) {
    const { data: memoryRow } = await admin
      .from("denis_guest_memory" as never)
      .select("visit_count")
      .eq("location_id", input.locationId)
      .eq("guest_token", guestToken)
      .maybeSingle();

    const visitCount = (memoryRow as { visit_count?: number } | null)
      ?.visit_count;
    if (typeof visitCount === "number" && visitCount > 1) {
      return true;
    }

    const since = new Date(input.openedAt);
    since.setDate(since.getDate() - RETURNING_LOOKBACK_DAYS);

    const { count } = await admin
      .from("table_sessions")
      .select("id", { count: "exact", head: true })
      .eq("location_id", input.locationId)
      .eq("guest_token", guestToken)
      .eq("status", "closed")
      .neq("id", input.sessionId)
      .gte("opened_at", since.toISOString())
      .lt("opened_at", input.openedAt);

    return (count ?? 0) > 0;
  }

  const guestDeviceId = input.guestDeviceId?.trim();
  if (!guestDeviceId) {
    return false;
  }

  const { count } = await admin
    .from("table_sessions")
    .select("id", { count: "exact", head: true })
    .eq("location_id", input.locationId)
    .eq("guest_device_id", guestDeviceId)
    .eq("status", "closed")
    .neq("id", input.sessionId)
    .lt("opened_at", input.openedAt);

  return (count ?? 0) > 0;
}

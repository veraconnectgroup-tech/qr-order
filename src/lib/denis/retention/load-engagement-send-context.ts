import { parseEventConfig, type EventConfig } from "@/lib/denis/venue/ops/event-mode";
import type { EngagementMenuProduct } from "@/lib/denis/retention/guest-engagement-loop";
import type { SupabaseClient } from "@supabase/supabase-js";

type ProductRow = {
  id: string;
  name: string;
  created_at: string;
};

export type EngagementSendContext = {
  newMenuItems: EngagementMenuProduct[];
  upcomingEvents: EventConfig[];
};

export async function loadEngagementSendContext(
  admin: SupabaseClient,
  input: {
    locationId: string;
    nowMs?: number;
    newItemDays?: number;
  }
): Promise<EngagementSendContext> {
  const nowMs = input.nowMs ?? Date.now();
  const newItemDays = input.newItemDays ?? 7;
  const since = new Date(nowMs - newItemDays * 86_400_000).toISOString();

  const [{ data: products }, { data: location }] = await Promise.all([
    admin
      .from("products")
      .select("id, name, created_at")
      .eq("location_id", input.locationId)
      .eq("is_available", true)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(40),
    admin
      .from("locations")
      .select("denis_event_config")
      .eq("id", input.locationId)
      .maybeSingle(),
  ]);

  const newMenuItems: EngagementMenuProduct[] = (
    (products ?? []) as ProductRow[]
  ).map((row) => ({
    id: row.id,
    name: row.name,
  }));

  const event = parseEventConfig(
    (location as { denis_event_config?: unknown } | null)?.denis_event_config
  );
  const upcomingEvents = event ? [event] : [];

  return { newMenuItems, upcomingEvents };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type EventConfig,
  type EventGatheringDetection,
  buildEventCopilotLines,
  detectEventGathering,
  formatEventGatheringConfirmHint,
  parseEventConfig,
  resolveEventEffects,
  resolveEventPhase,
} from "@/lib/denis/venue/ops/event-mode";
import {
  loadEventCopilotStats,
  loadRecentSessionOpens,
} from "@/lib/denis/venue/ops/load-event-order-stats";
import { loadFloorGraph } from "@/lib/denis/venue/floor/load-floor-graph";
import type { VenueOperatingMode } from "@/lib/denis/venue/ops/types";
import type { EventCopilotBlock } from "@/lib/denis/venue/copilot/types";

export type EventAdminProduct = {
  id: string;
  name: string;
  categoryName: string | null;
};

export type EventAdminSnapshot = {
  locationId: string;
  operatingMode: VenueOperatingMode;
  event: EventConfig | null;
  eventPhase: ReturnType<typeof resolveEventPhase> | null;
  products: EventAdminProduct[];
  copilotBlock: EventCopilotBlock | null;
  gathering: EventGatheringDetection | null;
  gatheringHint: string | null;
};

type LocationRow = {
  denis_operating_mode: VenueOperatingMode;
  denis_event_config: unknown;
};

type ProductRow = {
  id: string;
  name: string;
  category: { name: string } | null;
};

export async function loadEventAdminSnapshot(
  admin: SupabaseClient,
  locationId: string
): Promise<EventAdminSnapshot> {
  const [{ data: locationRow }, { data: productRows }, floor, recentOpens] =
    await Promise.all([
      admin
        .from("locations")
        .select("denis_operating_mode, denis_event_config")
        .eq("id", locationId)
        .maybeSingle(),
      admin
        .from("products")
        .select("id, name, category:categories(name)")
        .eq("location_id", locationId)
        .eq("is_available", true)
        .is("deleted_at", null)
        .order("name"),
      loadFloorGraph(admin, locationId),
      loadRecentSessionOpens(admin, { locationId }),
    ]);

  const location = locationRow as LocationRow | null;
  const operatingMode = location?.denis_operating_mode ?? "normal";
  const event = parseEventConfig(location?.denis_event_config);
  const eventPhase = event ? resolveEventPhase(event) : null;
  const gathering = detectEventGathering({ recentSessionOpens: recentOpens });

  const products = ((productRows ?? []) as unknown as ProductRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    categoryName: row.category?.name ?? null,
  }));

  let copilotBlock: EventCopilotBlock | null = null;
  if (operatingMode === "event" && event && eventPhase) {
    const effects = resolveEventEffects(event, eventPhase);
    const stats = await loadEventCopilotStats(admin, {
      locationId,
      floor,
    });
    copilotBlock = {
      title: "Event mode",
      lines: buildEventCopilotLines({ event, effects, stats }),
    };
  }

  return {
    locationId,
    operatingMode,
    event,
    eventPhase,
    products,
    copilotBlock,
    gathering: gathering.isGathering ? gathering : null,
    gatheringHint:
      gathering.isGathering && operatingMode !== "event"
        ? formatEventGatheringConfirmHint(gathering)
        : null,
  };
}

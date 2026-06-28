import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadVenueInventorySnapshot,
  mergeUnavailableProductIds,
} from "@/lib/denis/intelligence/load-venue-inventory";
import type {
  StaffTableHint,
  VenueOpsBeliefs,
  VenueOperatingMode,
} from "@/lib/denis/venue/ops/types";

type LocationOpsRow = {
  denis_operating_mode: VenueOperatingMode;
  denis_kds_stress: "normal" | "high";
  accepting_orders: boolean;
  denis_event_config: unknown;
  timezone: string | null;
};

type UnavailableRow = { id: string; name: string };

type HintRow = {
  text: string;
  visibility: "denis_only" | "guest_safe";
  expires_at: string;
};

/** Load live venue ops beliefs for Denis planner (M13). */
export async function loadVenueOpsBeliefs(
  admin: SupabaseClient,
  input: {
    locationId: string;
    tableId: string;
  }
): Promise<VenueOpsBeliefs> {
  const { data: locationRow } = await admin
    .from("locations")
    .select(
      "denis_operating_mode, denis_kds_stress, accepting_orders, denis_event_config, timezone"
    )
    .eq("id", input.locationId)
    .maybeSingle();

  const location = locationRow as LocationOpsRow | null;

  const [{ data: unavailableRows }, { data: hintRow }, inventorySnapshot] =
    await Promise.all([
      admin
        .from("products")
        .select("id, name")
        .eq("location_id", input.locationId)
        .eq("is_available", false)
        .is("deleted_at", null),
      admin
        .from("denis_staff_table_hints" as never)
        .select("text, visibility, expires_at")
        .eq("location_id", input.locationId)
        .eq("table_id", input.tableId)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      loadVenueInventorySnapshot(admin, {
        locationId: input.locationId,
        timezone: location?.timezone,
      }),
    ]);

  const unavailable = (unavailableRows ?? []) as UnavailableRow[];
  const hint = hintRow as HintRow | null;

  const unavailableProductIds = mergeUnavailableProductIds(
    unavailable.map((row) => row.id),
    inventorySnapshot
  );

  const unavailableById = new Map(unavailable.map((row) => [row.id, row.name]));
  for (const level of inventorySnapshot.levels) {
    if (level.status === "out") {
      unavailableById.set(level.productId, level.productName);
    }
  }
  const unavailableProductNames = unavailableProductIds
    .map((id) => unavailableById.get(id))
    .filter((name): name is string => Boolean(name?.trim()));

  let staffHint: StaffTableHint | null = null;
  if (hint?.text?.trim()) {
    staffHint = {
      text: hint.text.trim(),
      visibility: hint.visibility,
      expiresAt: hint.expires_at,
    };
  }

  return {
    operatingMode: location?.denis_operating_mode ?? "normal",
    kdsStress: location?.denis_kds_stress ?? "normal",
    acceptingOrders: location?.accepting_orders ?? true,
    unavailableProductIds,
    unavailableProductNames,
    staffHint,
    eventConfig: location?.denis_event_config ?? null,
  };
}

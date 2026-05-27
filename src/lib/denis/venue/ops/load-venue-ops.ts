import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  StaffTableHint,
  VenueOpsBeliefs,
  VenueOperatingMode,
} from "@/lib/denis/venue/ops/types";

type LocationOpsRow = {
  denis_operating_mode: VenueOperatingMode;
  denis_kds_stress: "normal" | "high";
  accepting_orders: boolean;
};

type UnavailableRow = { id: string };

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
  const [{ data: locationRow }, { data: unavailableRows }, { data: hintRow }] =
    await Promise.all([
      admin
        .from("locations")
        .select("denis_operating_mode, denis_kds_stress, accepting_orders")
        .eq("id", input.locationId)
        .maybeSingle(),
      admin
        .from("products")
        .select("id")
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
    ]);

  const location = locationRow as LocationOpsRow | null;
  const unavailable = (unavailableRows ?? []) as UnavailableRow[];
  const hint = hintRow as HintRow | null;

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
    unavailableProductIds: unavailable.map((row) => row.id),
    staffHint,
  };
}

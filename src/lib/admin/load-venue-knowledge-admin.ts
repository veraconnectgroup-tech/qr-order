import { loadVenueKnowledgeForLocation } from "@/lib/denis/learning/rollup-venue-knowledge";
import type { VenueKnowledgeAdminSnapshot } from "@/components/admin/denis-venue-knowledge-panel";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadVenueKnowledgeAdminSnapshot(
  admin: SupabaseClient,
  input: { locationId: string }
): Promise<VenueKnowledgeAdminSnapshot | null> {
  const loaded = await loadVenueKnowledgeForLocation(admin, input.locationId);
  if (!loaded) {
    return {
      locationId: input.locationId,
      updatedAt: null,
      knowledge: null,
    };
  }

  return {
    locationId: input.locationId,
    updatedAt: loaded.updatedAt,
    knowledge: loaded.snapshot,
  };
}

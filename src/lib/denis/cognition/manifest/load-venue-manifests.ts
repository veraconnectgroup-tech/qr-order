import { parseVenueManifest } from "@/lib/denis/cognition/manifest/venue-manifest.schema";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

type LocationManifestRow = {
  venue_manifest: unknown;
  organization: {
    venue_manifest: unknown;
  } | null;
};

export type VenueManifestBundle = {
  locationRaw: unknown;
  orgRaw: unknown;
};

export async function loadVenueManifestsForLocation(
  locationId: string
): Promise<VenueManifestBundle> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("locations")
    .select(
      "venue_manifest, organization:organizations(venue_manifest)"
    )
    .eq("id", locationId)
    .maybeSingle();

  if (error || !data) {
    logger.warn("Venue manifest load failed — proceeding without manifest", {
      locationId,
      error: error?.message ?? "not found",
    });
    return { locationRaw: null, orgRaw: null };
  }

  const row = data as unknown as LocationManifestRow;
  return {
    locationRaw: row.venue_manifest ?? null,
    orgRaw: row.organization?.venue_manifest ?? null,
  };
}

export function parseVenueManifestBundle(bundle: VenueManifestBundle) {
  return {
    locationManifest: parseVenueManifest(bundle.locationRaw),
    orgManifest: parseVenueManifest(bundle.orgRaw),
  };
}

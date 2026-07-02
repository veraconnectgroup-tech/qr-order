import {
  SKYLINE_PILOT_LOCATION_ID,
  SKYLINE_PILOT_VENUE_MANIFEST,
} from "@/lib/denis/config/pilot-wiring";
import { parseVenueManifest } from "@/lib/denis/cognition/manifest/venue-manifest.schema";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseLocationVenueManifestRow } from "@/lib/supabase/parse-location-rows";

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
    if (locationId === SKYLINE_PILOT_LOCATION_ID) {
      return {
        locationRaw: SKYLINE_PILOT_VENUE_MANIFEST,
        orgRaw: null,
      };
    }
    return { locationRaw: null, orgRaw: null };
  }

  const row = parseLocationVenueManifestRow(data);
  let locationRaw = row.venue_manifest ?? null;
  const orgRaw = row.organization?.venue_manifest ?? null;

  if (
    locationId === SKYLINE_PILOT_LOCATION_ID &&
    !parseVenueManifest(locationRaw)
  ) {
    locationRaw = SKYLINE_PILOT_VENUE_MANIFEST;
  }

  return {
    locationRaw,
    orgRaw,
  };
}

export function parseVenueManifestBundle(bundle: VenueManifestBundle) {
  return {
    locationManifest: parseVenueManifest(bundle.locationRaw),
    orgManifest: parseVenueManifest(bundle.orgRaw),
  };
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, getStaffLocationContext } from "@/lib/auth/session";
import {
  PLAYBOOK_PACK_OPTIONS,
  resolvePlaybookPackDefinition,
} from "@/lib/denis/cognition/manifest/playbook-pack-registry";
import {
  previewPlaybookPackTurn,
  resolveCustomPlaybookPack,
  resolvePlaybookPackId,
} from "@/lib/denis/cognition/manifest/resolve-playbook-pack";
import {
  CustomPlaybookPackSchema,
  parseVenueManifest,
  VENUE_MANIFEST_OPEN_CAPABILITIES,
  type CustomPlaybookPack,
  type VenueManifest,
} from "@/lib/denis/cognition/manifest/venue-manifest.schema";
import { createAdminClient } from "@/lib/supabase/admin";

export type DenisPlaybookEditorSnapshot = {
  locationId: string;
  locationName: string;
  orgName: string;
  accessibleLocations: { id: string; name: string }[];
  orgPlaybookPackId: string | null;
  locationPlaybookPackId: string | null;
  effectivePlaybookPackId: string | null;
  customPlaybookPack: CustomPlaybookPack | null;
  useLocationOverride: boolean;
  packOptions: typeof PLAYBOOK_PACK_OPTIONS;
  canEdit: boolean;
};

const SavePlaybookSchema = z.object({
  locationId: z.string().uuid(),
  scope: z.enum(["org", "location"]),
  playbookPackId: z.string().trim().min(1).max(80).nullable(),
  useLocationOverride: z.boolean().optional(),
  customPlaybookPack: CustomPlaybookPackSchema.nullable().optional(),
});

function baseManifest(): VenueManifest {
  return {
    manifestVersion: 1,
    capabilities: VENUE_MANIFEST_OPEN_CAPABILITIES,
  };
}

function readManifest(raw: unknown): VenueManifest {
  return parseVenueManifest(raw) ?? baseManifest();
}

export async function loadDenisPlaybookEditorSnapshotAction(
  locationId?: string
): Promise<DenisPlaybookEditorSnapshot | { error: string }> {
  const staff = await requireAdmin();
  const { locationId: activeLocationId, accessibleLocations } =
    await getStaffLocationContext(staff);

  const targetLocationId = locationId ?? activeLocationId;
  if (!targetLocationId) {
    return { error: "No location assigned." };
  }

  if (!accessibleLocations.some((row) => row.id === targetLocationId)) {
    return { error: "Location not accessible." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("locations")
    .select(
      "id, name, venue_manifest, organization:organizations(name, venue_manifest)"
    )
    .eq("id", targetLocationId)
    .eq("org_id", staff.org_id)
    .maybeSingle();

  if (error || !data) {
    return { error: "Location not found." };
  }

  const locationRow = data as {
    id: string;
    name: string;
    venue_manifest: unknown;
    organization: { name?: string; venue_manifest?: unknown } | null;
  };

  const orgManifest = readManifest(locationRow.organization?.venue_manifest ?? null);
  const locationManifest = readManifest(locationRow.venue_manifest ?? null);

  const orgPlaybookPackId = orgManifest.playbookPackId ?? null;
  const locationPlaybookPackId = locationManifest.playbookPackId ?? null;
  const effectivePlaybookPackId = resolvePlaybookPackId(orgManifest, locationManifest);
  const customPlaybookPack = resolveCustomPlaybookPack(orgManifest, locationManifest);

  return {
    locationId: locationRow.id,
    locationName: locationRow.name,
    orgName: locationRow.organization?.name?.trim() || "Restaurant",
    accessibleLocations,
    orgPlaybookPackId,
    locationPlaybookPackId,
    effectivePlaybookPackId,
    customPlaybookPack,
    useLocationOverride: Boolean(locationPlaybookPackId),
    packOptions: PLAYBOOK_PACK_OPTIONS,
    canEdit: staff.role === "owner" || staff.role === "manager",
  };
}

export async function saveDenisPlaybookPackAction(input: {
  locationId: string;
  scope: "org" | "location";
  playbookPackId: string | null;
  useLocationOverride?: boolean;
  customPlaybookPack?: CustomPlaybookPack | null;
}) {
  const staff = await requireAdmin();
  if (staff.role !== "owner" && staff.role !== "manager") {
    return { error: "Insufficient permissions." as const };
  }

  const parsed = SavePlaybookSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid playbook pack payload." as const };
  }

  if (parsed.data.playbookPackId === "custom" && !parsed.data.customPlaybookPack) {
    return { error: "Custom pack requires configuration." as const };
  }

  if (
    parsed.data.playbookPackId &&
    parsed.data.playbookPackId !== "custom" &&
    !resolvePlaybookPackDefinition(parsed.data.playbookPackId)
  ) {
    return { error: "Unknown playbook pack." as const };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("locations")
    .select(
      "id, venue_manifest, org_id, organization:organizations(venue_manifest)"
    )
    .eq("id", parsed.data.locationId)
    .eq("org_id", staff.org_id)
    .maybeSingle();

  if (error || !data) {
    return { error: "Location not found." as const };
  }

  const locationRow = data as {
    id: string;
    venue_manifest: unknown;
    org_id: string;
    organization: { venue_manifest?: unknown } | null;
  };

  const orgManifest = readManifest(locationRow.organization?.venue_manifest ?? null);
  const locationManifest = readManifest(locationRow.venue_manifest ?? null);

  const patchPack = (manifest: VenueManifest): VenueManifest => {
    const next: VenueManifest = { ...manifest };
    if (parsed.data.playbookPackId) {
      next.playbookPackId = parsed.data.playbookPackId;
    } else {
      delete next.playbookPackId;
    }
    if (parsed.data.playbookPackId === "custom" && parsed.data.customPlaybookPack) {
      next.customPlaybookPack = parsed.data.customPlaybookPack;
    } else {
      delete next.customPlaybookPack;
    }
    return next;
  };

  if (parsed.data.scope === "org") {
    const nextOrg = patchPack(orgManifest);
    const { error: orgError } = await admin
      .from("organizations")
      .update({
        venue_manifest: nextOrg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", locationRow.org_id);

    if (orgError) return { error: orgError.message };

    if (parsed.data.useLocationOverride === false) {
      const clearedLocation = { ...locationManifest };
      delete clearedLocation.playbookPackId;
      delete clearedLocation.customPlaybookPack;
      await admin
        .from("locations")
        .update({
          venue_manifest: clearedLocation,
          updated_at: new Date().toISOString(),
        })
        .eq("id", parsed.data.locationId);
    }
  } else {
    const nextLocation =
      parsed.data.useLocationOverride === false
        ? (() => {
            const cleared = { ...locationManifest };
            delete cleared.playbookPackId;
            delete cleared.customPlaybookPack;
            return cleared;
          })()
        : patchPack(locationManifest);

    const { error: locError } = await admin
      .from("locations")
      .update({
        venue_manifest: nextLocation,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.locationId);

    if (locError) return { error: locError.message };
  }

  revalidatePath("/admin/denis");
  return { success: true as const };
}

export async function previewDenisPlaybookPackAction(input: {
  packId: string | null;
  customPlaybookPack?: CustomPlaybookPack | null;
  orgName: string;
  userMessage?: string;
}) {
  await requireAdmin();
  return previewPlaybookPackTurn({
    packId: input.packId,
    customPack: input.customPlaybookPack ?? null,
    orgName: input.orgName,
    userMessage: input.userMessage,
  });
}

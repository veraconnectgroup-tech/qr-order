"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, getStaffLocationContext } from "@/lib/auth/session";
import { invalidateConciergeConfigCache } from "@/lib/denis/config/config-cache";
import {
  parsePartialConciergeConfig,
  type PartialConciergeConfig,
} from "@/lib/denis/config/concierge-config.schema";
import {
  mergePartialConciergeConfig,
  resolveConciergeConfig,
} from "@/lib/denis/config/merge-concierge-config";
import { importConciergeConfig } from "@/lib/denis/config/concierge-config-io";
import {
  diffConciergeConfig,
  summarizeConfigDiff,
} from "@/lib/denis/config/config-versioning";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseLocationConciergeConfigRow } from "@/lib/supabase/parse-location-rows";

export type DenisConfigEditorLocation = {
  id: string;
  name: string;
};

export type DenisConfigEditorSnapshot = {
  locationId: string;
  locationName: string;
  accessibleLocations: DenisConfigEditorLocation[];
  locationOverride: PartialConciergeConfig;
  orgOverride: PartialConciergeConfig;
  effectiveConfig: ReturnType<typeof resolveConciergeConfig>;
  canEdit: boolean;
};

async function assertAccessibleLocation(
  staff: Awaited<ReturnType<typeof requireAdmin>>,
  locationId: string
): Promise<
  | { error: string }
  | { accessibleLocations: DenisConfigEditorLocation[] }
> {
  const { accessibleLocations } = await getStaffLocationContext(staff);
  if (!accessibleLocations.some((row) => row.id === locationId)) {
    return { error: "Location not accessible." };
  }
  return { accessibleLocations };
}

export async function loadDenisConfigEditorSnapshotAction(
  locationId?: string
): Promise<DenisConfigEditorSnapshot | { error: string }> {
  const staff = await requireAdmin();
  const { locationId: activeLocationId, accessibleLocations } =
    await getStaffLocationContext(staff);

  const targetLocationId = locationId ?? activeLocationId;
  if (!targetLocationId) {
    return { error: "No location assigned." };
  }

  const access = await assertAccessibleLocation(staff, targetLocationId);
  if ("error" in access) {
    return { error: access.error };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("locations")
    .select(
      "id, name, menu_locale, ai_concierge_config, organization:organizations(ai_concierge_config)"
    )
    .eq("id", targetLocationId)
    .eq("org_id", staff.org_id)
    .maybeSingle();

  if (error || !data) {
    return { error: "Location not found." };
  }

  const row = parseLocationConciergeConfigRow(data);
  const locationMeta = data as { id: string; name: string };

  const locationOverride =
    parsePartialConciergeConfig(row.ai_concierge_config) ?? {};
  const orgOverride =
    parsePartialConciergeConfig(row.organization?.ai_concierge_config ?? null) ??
    {};

  return {
    locationId: locationMeta.id,
    locationName: locationMeta.name,
    accessibleLocations,
    locationOverride,
    orgOverride,
    effectiveConfig: resolveConciergeConfig({
      orgConfig: orgOverride,
      locationConfig: locationOverride,
      menuLocale: row.menu_locale,
    }),
    canEdit: staff.role === "owner" || staff.role === "manager",
  };
}

export async function saveDenisConfigEditorPatchAction(input: {
  locationId: string;
  patch: PartialConciergeConfig;
  changeNote?: string;
}) {
  const staff = await requireAdmin();
  const access = await assertAccessibleLocation(staff, input.locationId);
  if ("error" in access) {
    return { error: access.error };
  }

  const parsed = parsePartialConciergeConfig(input.patch);
  if (!parsed) return { error: "Invalid config patch." as const };

  const admin = createAdminClient();
  const { data: locationRow } = await admin
    .from("locations")
    .select("ai_concierge_config")
    .eq("id", input.locationId)
    .eq("org_id", staff.org_id)
    .maybeSingle();

  const current = parsePartialConciergeConfig(
    (locationRow as { ai_concierge_config?: unknown } | null)?.ai_concierge_config
  );
  const merged = mergePartialConciergeConfig(current, parsed);

  await admin
    .from("locations")
    .update({ ai_concierge_config: merged as never })
    .eq("id", input.locationId)
    .eq("org_id", staff.org_id);

  await admin.from("config_change_log").insert({
    org_id: staff.org_id,
    location_id: input.locationId,
    changed_by: staff.role === "owner" ? "owner" : "admin",
    config_path: "ai_concierge_config",
    old_value: (current ?? {}) as never,
    new_value: merged as never,
    reason: input.changeNote ?? "Denis config editor",
  } as never);

  await invalidateConciergeConfigCache(input.locationId);
  revalidatePath("/admin/denis");
  revalidatePath("/admin/settings");

  return {
    success: true as const,
    diffLines: summarizeConfigDiff(diffConciergeConfig(current, merged)),
  };
}

export async function importDenisConfigEditorAction(input: {
  locationId: string;
  json: string;
}) {
  const imported = importConciergeConfig(input.json);
  if (!imported.ok) {
    return { error: imported.error };
  }

  return saveDenisConfigEditorPatchAction({
    locationId: input.locationId,
    patch: imported.config,
    changeNote: "Imported concierge config JSON",
  });
}

export async function resetDenisConfigEditorLocationAction(locationId: string) {
  const staff = await requireAdmin();
  const access = await assertAccessibleLocation(staff, locationId);
  if ("error" in access) {
    return { error: access.error };
  }

  const admin = createAdminClient();
  const { data: locationRow } = await admin
    .from("locations")
    .select("ai_concierge_config")
    .eq("id", locationId)
    .eq("org_id", staff.org_id)
    .maybeSingle();

  const current = parsePartialConciergeConfig(
    (locationRow as { ai_concierge_config?: unknown } | null)?.ai_concierge_config
  );

  await admin
    .from("locations")
    .update({ ai_concierge_config: {} as never })
    .eq("id", locationId)
    .eq("org_id", staff.org_id);

  await admin.from("config_change_log").insert({
    org_id: staff.org_id,
    location_id: locationId,
    changed_by: staff.role === "owner" ? "owner" : "admin",
    config_path: "ai_concierge_config",
    old_value: (current ?? {}) as never,
    new_value: {} as never,
    reason: "Reset location Denis override",
  } as never);

  await invalidateConciergeConfigCache(locationId);
  revalidatePath("/admin/denis");

  return { success: true as const };
}

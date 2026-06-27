"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, getStaffLocationId } from "@/lib/auth/session";
import { invalidateConciergeConfigCache } from "@/lib/denis/config/config-cache";
import {
  parsePartialConciergeConfig,
  type PartialConciergeConfig,
} from "@/lib/denis/config/concierge-config.schema";
import { mergePartialConciergeConfig } from "@/lib/denis/config/merge-concierge-config";
import {
  buildConfigVersion,
  diffConciergeConfig,
  summarizeConfigDiff,
} from "@/lib/denis/config/config-versioning";
import { loadConfigChangeHistory } from "@/lib/admin/load-config-change-history";
import {
  clearConfigShadow,
  getConfigShadow,
  setConfigShadow,
} from "@/lib/denis/config/config-shadow";
import { createAdminClient } from "@/lib/supabase/admin";

export async function loadDenisConfigVersioningSnapshotAction() {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) return { error: "No location assigned." as const };

  const admin = createAdminClient();
  const [{ data: locationRow }, history] = await Promise.all([
    admin
      .from("locations")
      .select("ai_concierge_config")
      .eq("id", locationId)
      .eq("org_id", staff.org_id)
      .maybeSingle(),
    loadConfigChangeHistory(admin, {
      orgId: staff.org_id,
      locationId,
      limit: 12,
    }),
  ]);

  const current = parsePartialConciergeConfig(
    (locationRow as { ai_concierge_config?: unknown } | null)
      ?.ai_concierge_config
  );

  return {
    locationId,
    currentConfig: current ?? {},
    history,
    version: history.length + 1,
    shadow: await getConfigShadow(locationId),
  };
}

export async function previewDenisConfigPatchAction(
  patch: PartialConciergeConfig
) {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) return { error: "No location assigned." as const };

  const parsed = parsePartialConciergeConfig(patch);
  if (!parsed) return { error: "Invalid config patch." as const };

  const admin = createAdminClient();
  const { data: locationRow } = await admin
    .from("locations")
    .select("ai_concierge_config")
    .eq("id", locationId)
    .eq("org_id", staff.org_id)
    .maybeSingle();

  const current = parsePartialConciergeConfig(
    (locationRow as { ai_concierge_config?: unknown } | null)
      ?.ai_concierge_config
  );
  const merged = mergePartialConciergeConfig(current, parsed);
  const diff = diffConciergeConfig(current, merged);

  return {
    merged,
    diffLines: summarizeConfigDiff(diff),
  };
}

export async function enableDenisConfigShadowAction(input: {
  patch: PartialConciergeConfig;
  changeNote?: string;
}) {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) return { error: "No location assigned." as const };

  const parsed = parsePartialConciergeConfig(input.patch);
  if (!parsed) return { error: "Invalid config patch." as const };

  const shadow = await setConfigShadow(locationId, {
    patch: parsed,
    appliedBy: staff.role === "owner" ? "owner" : "admin",
    changeNote: input.changeNote ?? "Config shadow test",
  });

  if (!shadow) {
    return { error: "Shadow mode unavailable (Redis required)." as const };
  }

  revalidatePath("/admin/settings");
  return { success: true as const, shadow };
}

export async function clearDenisConfigShadowAction() {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) return { error: "No location assigned." as const };

  await clearConfigShadow(locationId);
  revalidatePath("/admin/settings");
  return { success: true as const };
}

export async function applyDenisConfigPatchAction(input: {
  patch: PartialConciergeConfig;
  changeNote?: string;
}) {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) return { error: "No location assigned." as const };

  const parsed = parsePartialConciergeConfig(input.patch);
  if (!parsed) return { error: "Invalid config patch." as const };

  const admin = createAdminClient();
  const { data: locationRow } = await admin
    .from("locations")
    .select("ai_concierge_config")
    .eq("id", locationId)
    .eq("org_id", staff.org_id)
    .maybeSingle();

  const current = parsePartialConciergeConfig(
    (locationRow as { ai_concierge_config?: unknown } | null)
      ?.ai_concierge_config
  );
  const merged = mergePartialConciergeConfig(current, parsed);

  await admin
    .from("locations")
    .update({ ai_concierge_config: merged as never })
    .eq("id", locationId)
    .eq("org_id", staff.org_id);

  const version = buildConfigVersion({
    id: crypto.randomUUID(),
    locationId,
    version: Date.now(),
    config: merged,
    previousConfig: current,
    appliedAt: new Date().toISOString(),
    appliedBy: staff.id,
    changeNote: input.changeNote,
  });

  await admin.from("config_change_log").insert({
    org_id: staff.org_id,
    location_id: locationId,
    changed_by: staff.role === "owner" ? "owner" : "admin",
    config_path: "ai_concierge_config",
    old_value: (current ?? {}) as never,
    new_value: merged as never,
    reason: input.changeNote ?? "Owner config apply",
  } as never);

  await invalidateConciergeConfigCache(locationId);
  await clearConfigShadow(locationId);
  revalidatePath("/admin/settings");

  return {
    success: true as const,
    version: version.version,
    diffLines: summarizeConfigDiff(version.diff),
  };
}

export async function rollbackDenisConfigAction(logEntryId: string) {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) return { error: "No location assigned." as const };

  const admin = createAdminClient();
  const { data: logRow } = await admin
    .from("config_change_log")
    .select("id, old_value, new_value, location_id")
    .eq("id", logEntryId)
    .eq("org_id", staff.org_id)
    .eq("location_id", locationId)
    .maybeSingle();

  if (!logRow) return { error: "Config version not found." as const };

  const restore = parsePartialConciergeConfig(
    (logRow as { old_value?: unknown }).old_value
  );
  if (!restore) return { error: "Nothing to restore." as const };

  const { data: locationRow } = await admin
    .from("locations")
    .select("ai_concierge_config")
    .eq("id", locationId)
    .maybeSingle();

  const current = parsePartialConciergeConfig(
    (locationRow as { ai_concierge_config?: unknown } | null)
      ?.ai_concierge_config
  );

  await admin
    .from("locations")
    .update({ ai_concierge_config: restore as never })
    .eq("id", locationId)
    .eq("org_id", staff.org_id);

  await admin.from("config_change_log").insert({
    org_id: staff.org_id,
    location_id: locationId,
    changed_by: staff.role === "owner" ? "owner" : "admin",
    config_path: "ai_concierge_config",
    old_value: (current ?? {}) as never,
    new_value: restore as never,
    reason: `Rollback to version ${logEntryId.slice(0, 8)}`,
  } as never);

  await invalidateConciergeConfigCache(locationId);
  await clearConfigShadow(locationId);
  revalidatePath("/admin/settings");

  return { success: true as const };
}

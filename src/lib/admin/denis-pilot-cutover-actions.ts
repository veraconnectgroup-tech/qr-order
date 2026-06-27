"use server";

import { revalidatePath } from "next/cache";
import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import {
  parsePartialConciergeConfig,
  PartialConciergeConfigSchema,
  type ConciergePilotCutover,
  type PilotCutoverStage,
} from "@/lib/denis/config/concierge-config.schema";
import { invalidateConciergeConfigCache } from "@/lib/denis/config/config-cache";
import { mergePartialConciergeConfig } from "@/lib/denis/config/merge-concierge-config";
import {
  buildPilotStagePatch,
  nextPilotCutoverStage,
  pilotCutoverStageLabel,
} from "@/lib/denis/config/pilot-cutover-ladder";
import { loadPilotEvalPassRate } from "@/lib/denis/eval/pilot-readiness-eval";
import {
  checkPilotReadiness,
  type PilotReadiness,
} from "@/lib/denis/config/pilot-venue-checklist";
import { createAdminClient } from "@/lib/supabase/admin";

export type PilotCutoverAdminState = PilotReadiness & {
  envRolloutOverride: string | null;
};

export async function loadPilotCutoverAdminState(): Promise<
  PilotCutoverAdminState | { error: string }
> {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return { error: "Location not found." };
  }

  const admin = createAdminClient();
  const readiness = await checkPilotReadiness(admin, locationId, {
    deps: { evalPassRatePct: loadPilotEvalPassRate() },
  });

  return {
    ...readiness,
    envRolloutOverride: process.env.DENIS_ROLLOUT_MODE?.trim() ?? null,
  };
}

export async function applyPilotGoLive(input: {
  staffCopilotAcknowledged: boolean;
}): Promise<
  | { success: true; stage: PilotCutoverStage; label: string }
  | { error: string }
> {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return { error: "Location not found." };
  }

  if (process.env.DENIS_ROLLOUT_MODE?.trim()) {
    return {
      error: "Remove DENIS_ROLLOUT_MODE env override before pilot cutover.",
    };
  }

  const admin = createAdminClient();
  const readiness = await checkPilotReadiness(admin, locationId, {
    staffCopilotAcknowledged: input.staffCopilotAcknowledged,
    deps: { evalPassRatePct: loadPilotEvalPassRate() },
  });

  if (!readiness.ready) {
    return {
      error: `Pilot not ready: ${readiness.blockers.join("; ")}`,
    };
  }

  const targetStage = readiness.nextStage;
  if (!targetStage) {
    return { error: "Pilot ladder complete — already at denis_only." };
  }

  const { data: row, error: loadError } = await admin
    .from("locations")
    .select("ai_concierge_config")
    .eq("id", locationId)
    .maybeSingle();

  if (loadError || !row) {
    return { error: loadError?.message ?? "Location not found." };
  }

  const rawConfig = (row as { ai_concierge_config: unknown }).ai_concierge_config;
  const existing = parsePartialConciergeConfig(rawConfig);
  const rollbackSnapshot =
    existing?.pilotCutover?.rollbackSnapshot ??
    (rawConfig && typeof rawConfig === "object"
      ? (rawConfig as Record<string, unknown>)
      : {});

  const pilotCutover: ConciergePilotCutover = {
    stage: targetStage,
    appliedAt: new Date().toISOString(),
    rollbackSnapshot,
    staffCopilotAcknowledged: input.staffCopilotAcknowledged,
  };

  const patch = mergePartialConciergeConfig(existing, {
    ...buildPilotStagePatch(targetStage),
    pilotCutover,
  });

  const parsed = PartialConciergeConfigSchema.safeParse(patch);
  if (!parsed.success) {
    return { error: "Invalid pilot config patch." };
  }

  const { error: updateError } = await admin
    .from("locations")
    .update({
      ai_concierge_config: parsed.data as never,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", locationId);

  if (updateError) {
    return { error: updateError.message };
  }

  await invalidateConciergeConfigCache(locationId);
  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");

  return {
    success: true,
    stage: targetStage,
    label: pilotCutoverStageLabel(targetStage),
  };
}

/** Restore pre-cutover config — single DB update (H1 rollback <30s). */
export async function rollbackPilotCutover(): Promise<
  { success: true } | { error: string }
> {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return { error: "Location not found." };
  }

  const admin = createAdminClient();
  const { data: row, error: loadError } = await admin
    .from("locations")
    .select("ai_concierge_config")
    .eq("id", locationId)
    .maybeSingle();

  if (loadError || !row) {
    return { error: loadError?.message ?? "Location not found." };
  }

  const partial = parsePartialConciergeConfig(
    (row as { ai_concierge_config: unknown }).ai_concierge_config
  );
  const snapshot = partial?.pilotCutover?.rollbackSnapshot;
  if (!snapshot || typeof snapshot !== "object") {
    return { error: "No rollback snapshot — nothing to restore." };
  }

  const { error: updateError } = await admin
    .from("locations")
    .update({
      ai_concierge_config: snapshot as never,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", locationId);

  if (updateError) {
    return { error: updateError.message };
  }

  await invalidateConciergeConfigCache(locationId);
  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");

  return { success: true };
}

export async function previewNextPilotStage(): Promise<
  | { stage: PilotCutoverStage; label: string }
  | { error: string }
  | { complete: true }
> {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return { error: "Location not found." };
  }

  const admin = createAdminClient();
  const readiness = await checkPilotReadiness(admin, locationId, {
    deps: { evalPassRatePct: loadPilotEvalPassRate() },
  });
  if (!readiness.nextStage) {
    return { complete: true };
  }

  return {
    stage: readiness.nextStage,
    label: pilotCutoverStageLabel(readiness.nextStage),
  };
}

export { nextPilotCutoverStage };

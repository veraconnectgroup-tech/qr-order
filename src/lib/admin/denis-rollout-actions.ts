"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import {
  PartialConciergeConfigSchema,
  parsePartialConciergeConfig,
} from "@/lib/denis/config/concierge-config.schema";
import { invalidateConciergeConfigCache } from "@/lib/denis/config/config-cache";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { mergePartialConciergeConfig } from "@/lib/denis/config/merge-concierge-config";
import {
  denisRolloutFormFromEffective,
  denisRolloutPatchFromForm,
  type DenisRolloutFormState,
} from "@/lib/denis/config/rollout-cutover";
import {
  ConciergeRolloutModeSchema,
  parseRolloutModeFromEnv,
  resolveEffectiveRollout,
  resolveGuestLegacyPath,
  kernelTimelineEnabled,
  shouldRunShadowDiff,
} from "@/lib/denis/config/rollout";
import { createAdminClient } from "@/lib/supabase/admin";

const denisRolloutFormSchema = z.object({
  rolloutMode: ConciergeRolloutModeSchema,
  canaryPercent: z.number().int().min(0).max(100),
  narrateWithLlm: z.boolean(),
  slotExtractEnabled: z.boolean(),
  slotExtractWithLlm: z.boolean(),
  returnGuestEnabled: z.boolean(),
  voiceEnabled: z.boolean(),
  actLayerEnabled: z.boolean(),
  actDryRun: z.boolean(),
  actSubmitEnabled: z.boolean(),
  legacyOrderingEnabled: z.boolean(),
});

export type DenisRolloutAdminState = {
  effective: DenisRolloutFormState;
  envRolloutOverride: string | null;
  guestSeesLegacy: boolean;
  timelineEnabled: boolean;
  shadowDiffEnabled: boolean;
};

export async function loadDenisRolloutAdminState(): Promise<
  DenisRolloutAdminState | { error: string }
> {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return { error: "Location not found." };
  }

  const config = await loadConciergeConfigForLocation(locationId, {
    bypassCache: true,
  });
  const storedForm = denisRolloutFormFromEffective(config);
  const effectiveRollout = resolveEffectiveRollout(config);
  const envRolloutOverride = parseRolloutModeFromEnv();

  return {
    effective: storedForm,
    envRolloutOverride,
    guestSeesLegacy: resolveGuestLegacyPath(effectiveRollout.mode, {
      canaryPercent: effectiveRollout.canaryPercent,
    }),
    timelineEnabled: kernelTimelineEnabled(effectiveRollout.mode),
    shadowDiffEnabled: shouldRunShadowDiff(effectiveRollout.mode),
  };
}

export async function saveDenisRolloutConfig(
  raw: DenisRolloutFormState
): Promise<{ success: true } | { error: string }> {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return { error: "Location not found." };
  }

  const parsed = denisRolloutFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Invalid rollout settings." };
  }

  if (parsed.data.actSubmitEnabled && !parsed.data.actLayerEnabled) {
    return { error: "Enable act layer before allowing order submit." };
  }

  if (parsed.data.actSubmitEnabled && parsed.data.actDryRun) {
    return { error: "Disable act dry-run before enabling order submit." };
  }

  if (
    parsed.data.actSubmitEnabled &&
    !parsed.data.actDryRun &&
    parsed.data.rolloutMode !== "denis_only"
  ) {
    return {
      error: "Live act submit (F8-3) requires rollout mode denis_only.",
    };
  }

  if (
    parsed.data.actSubmitEnabled &&
    !parsed.data.legacyOrderingEnabled &&
    !parsed.data.actLayerEnabled
  ) {
    return {
      error: "Kernel ordering off requires act layer when act submit is enabled.",
    };
  }

  if (
    parsed.data.narrateWithLlm &&
    parsed.data.rolloutMode !== "denis_only" &&
    parsed.data.rolloutMode !== "canary"
  ) {
    return {
      error: "Denis narration requires rollout mode denis_only or canary.",
    };
  }

  if (
    parsed.data.rolloutMode === "canary" &&
    parsed.data.narrateWithLlm &&
    parsed.data.canaryPercent <= 0
  ) {
    return {
      error: "Canary percent must be > 0 when narrate is enabled.",
    };
  }

  const patch = denisRolloutPatchFromForm(parsed.data);
  const patchParsed = PartialConciergeConfigSchema.safeParse(patch);
  if (!patchParsed.success) {
    return { error: "Invalid config patch." };
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

  const existing = parsePartialConciergeConfig(
    (row as { ai_concierge_config: unknown }).ai_concierge_config
  );
  const merged = mergePartialConciergeConfig(existing, patchParsed.data);

  const { error: updateError } = await admin
    .from("locations")
    .update({
      ai_concierge_config: merged as never,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", locationId);

  if (updateError) {
    return { error: updateError.message };
  }

  await invalidateConciergeConfigCache(locationId);

  revalidatePath("/admin/settings");
  revalidatePath("/admin/denis-debug");
  revalidatePath("/", "layout");

  return { success: true };
}

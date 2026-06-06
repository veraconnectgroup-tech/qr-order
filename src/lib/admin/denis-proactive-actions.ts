"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import {
  PartialConciergeProactiveSchema,
  parsePartialConciergeConfig,
} from "@/lib/denis/config/concierge-config.schema";
import { invalidateConciergeConfigCache } from "@/lib/denis/config/config-cache";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { mergePartialConciergeConfig } from "@/lib/denis/config/merge-concierge-config";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { createAdminClient } from "@/lib/supabase/admin";

const proactiveSettingsSchema = PartialConciergeProactiveSchema;

export type DenisProactiveAdminState = {
  proactive: ConciergeConfig["proactive"];
};

export async function loadDenisProactiveAdminState(): Promise<
  DenisProactiveAdminState | { error: string }
> {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return { error: "Location not found." };
  }

  const config = await loadConciergeConfigForLocation(locationId, {
    bypassCache: true,
  });

  return { proactive: config.proactive };
}

export async function saveDenisProactiveSettings(
  raw: z.infer<typeof proactiveSettingsSchema>
): Promise<{ success: true } | { error: string }> {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return { error: "Location not found." };
  }

  const parsed = proactiveSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Invalid proactive settings." };
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
  const merged = mergePartialConciergeConfig(existing, {
    proactive: parsed.data,
  });

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

  revalidatePath("/admin/denis-insights");
  revalidatePath("/admin/settings");

  return { success: true };
}

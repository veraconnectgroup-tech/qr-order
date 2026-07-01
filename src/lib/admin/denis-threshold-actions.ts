"use server";

import { revalidatePath } from "next/cache";
import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { mergePartialConciergeConfig } from "@/lib/denis/config/merge-concierge-config";
import type { ThresholdMetric } from "@/lib/denis/learning/threshold-optimizer";
import type { Json } from "@/types/database";
import { createAdminClient } from "@/lib/supabase/admin";

export async function applyThresholdOptimization(
  metrics: ThresholdMetric[]
): Promise<{ ok: boolean; error?: string }> {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return { ok: false, error: "No location assigned." };
  }

  if (metrics.length === 0) {
    return { ok: false, error: "No threshold changes to apply." };
  }

  const admin = createAdminClient();
  const { data: locationRow } = await admin
    .from("locations")
    .select("ai_concierge_config")
    .eq("id", locationId)
    .maybeSingle();

  const currentPartial =
    (locationRow as { ai_concierge_config?: unknown } | null)
      ?.ai_concierge_config ?? null;

  const proactivePatch: Record<string, number> = {};
  const upsellPatch: Record<string, number> = {};

  for (const row of metrics) {
    if (row.key === "dessertDelayMinutes") {
      upsellPatch.dessertDelayMinutes = row.optimalValue;
    } else {
      proactivePatch[row.key] = row.optimalValue;
    }
  }

  const merged = mergePartialConciergeConfig(currentPartial, {
    proactive:
      Object.keys(proactivePatch).length > 0 ? proactivePatch : undefined,
    upsell: Object.keys(upsellPatch).length > 0 ? upsellPatch : undefined,
  });

  const { error } = await admin
    .from("locations")
    .update({ ai_concierge_config: merged as Json })
    .eq("id", locationId);

  if (error) {
    return { ok: false, error: error.message };
  }

  await loadConciergeConfigForLocation(locationId, { bypassCache: true });
  revalidatePath("/admin/denis-insights");
  revalidatePath("/dashboard/optimization");
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import {
  applyLiveAbWinnerIfReady,
  loadLiveAbAdminSnapshot,
} from "@/lib/admin/denis-live-ab";
import { createAdminClient } from "@/lib/supabase/admin";

export async function approveLiveAbWinner(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return { ok: false, error: "No location assigned." };
  }

  const admin = createAdminClient();
  const snapshot = await loadLiveAbAdminSnapshot(admin, locationId);
  if (!snapshot.experiment) {
    return { ok: false, error: "No active experiment." };
  }

  await admin
    .from("denis_ab_experiments" as never)
    .update({
      owner_approved_apply: true,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", snapshot.experiment.id);

  const result = await applyLiveAbWinnerIfReady(admin, locationId);
  revalidatePath("/admin/denis-insights");
  revalidatePath("/admin/ab-experiments");

  if (!result.applied) {
    return {
      ok: false,
      error: "Experiment not ready for auto-apply yet.",
    };
  }

  return { ok: true };
}

export async function startLiveAbExperiment(input: {
  name: string;
  metric: "conversion_rate" | "avg_order_value" | "upsell_accept_rate" | "time_to_first_order";
  variantAConfig: Record<string, unknown>;
  variantBConfig: Record<string, unknown>;
  autoApply?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return { ok: false, error: "No location assigned." };
  }

  const admin = createAdminClient();
  const existing = await loadLiveAbAdminSnapshot(admin, locationId);
  if (existing.experiment) {
    return { ok: false, error: "Location already has a running experiment." };
  }

  const { error } = await admin.from("denis_ab_experiments" as never).insert({
    location_id: locationId,
    name: input.name.trim(),
    metric: input.metric,
    variant_a_config: input.variantAConfig,
    variant_b_config: input.variantBConfig,
    auto_apply: input.autoApply ?? false,
    min_sessions: 100,
    traffic_split: 0.5,
    status: "running",
  } as never);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/denis-insights");
  revalidatePath("/admin/ab-experiments");
  return { ok: true };
}

export async function stopLiveAbExperiment(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return { ok: false, error: "No location assigned." };
  }

  const admin = createAdminClient();
  const snapshot = await loadLiveAbAdminSnapshot(admin, locationId);
  if (!snapshot.experiment) {
    return { ok: false, error: "No active experiment." };
  }

  await admin
    .from("denis_ab_experiments" as never)
    .update({
      status: "stopped",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", snapshot.experiment.id);

  revalidatePath("/admin/denis-insights");
  revalidatePath("/admin/ab-experiments");
  return { ok: true };
}

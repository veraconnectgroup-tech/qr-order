"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStaffLocationId, requireAdmin } from "@/lib/auth/session";
import { parseEventConfig } from "@/lib/denis/venue/ops/event-mode";
import { createAdminClient } from "@/lib/supabase/admin";

const eventInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  expectedGuests: z.coerce.number().int().min(1).max(500),
  presetMenu: z.boolean(),
  presetProductIds: z.array(z.string().uuid()).max(200).optional(),
  startTime: z.string().trim().min(1).max(40),
  endTime: z.string().trim().min(1).max(40),
  specialInstructions: z.string().trim().max(500),
  cakeAt: z.string().trim().max(40).nullable().optional(),
  activateMode: z.boolean().optional(),
});

export async function saveDenisEventConfig(input: z.infer<typeof eventInputSchema>) {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return { error: "No location assigned." };
  }

  const parsed = eventInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid event configuration." };
  }

  const eventConfig = parseEventConfig({
    ...parsed.data,
    presetProductIds: parsed.data.presetMenu
      ? parsed.data.presetProductIds ?? []
      : undefined,
    cakeAt: parsed.data.cakeAt?.trim() || null,
  });

  if (!eventConfig) {
    return { error: "Invalid event configuration." };
  }

  const admin = createAdminClient();
  const patch: Record<string, unknown> = {
    denis_event_config: eventConfig,
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.activateMode) {
    patch.denis_operating_mode = "event";
  }

  const { error } = await admin
    .from("locations")
    .update(patch as never)
    .eq("id", locationId);

  if (error) return { error: error.message };

  revalidatePath("/admin/events");
  revalidatePath("/dashboard/denis");
  return { success: true, event: eventConfig };
}

export async function clearDenisEventConfig() {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return { error: "No location assigned." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("locations")
    .update({
      denis_event_config: null,
      denis_operating_mode: "normal",
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", locationId);

  if (error) return { error: error.message };

  revalidatePath("/admin/events");
  revalidatePath("/dashboard/denis");
  return { success: true };
}

export async function activateDenisEventMode(active: boolean) {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return { error: "No location assigned." };
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("locations")
    .select("denis_event_config")
    .eq("id", locationId)
    .maybeSingle();

  if (active && !parseEventConfig((row as { denis_event_config?: unknown } | null)?.denis_event_config)) {
    return { error: "Save an event profile before activating event mode." };
  }

  const { error } = await admin
    .from("locations")
    .update({
      denis_operating_mode: active ? "event" : "normal",
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", locationId);

  if (error) return { error: error.message };

  revalidatePath("/admin/events");
  revalidatePath("/dashboard/denis");
  return { success: true };
}

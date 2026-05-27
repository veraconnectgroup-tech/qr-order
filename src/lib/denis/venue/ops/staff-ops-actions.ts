"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  getStaffLocationId,
  requireStaff,
} from "@/lib/auth/session";
import type { VenueOperatingMode } from "@/lib/denis/venue/ops/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/security/sanitize";

const operatingModeSchema = z.enum([
  "normal",
  "rush",
  "kitchen_closed",
  "event",
]);

const tableHintSchema = z.object({
  tableId: z.string().uuid(),
  text: z.string().trim().min(1).max(500),
  visibility: z.enum(["denis_only", "guest_safe"]).default("denis_only"),
  expiresInMinutes: z.number().int().min(5).max(480).default(120),
});

export async function setDenisOperatingMode(mode: VenueOperatingMode) {
  const staff = await requireStaff();
  if (!["owner", "manager"].includes(staff.role)) {
    return { error: "Not allowed." };
  }

  const parsed = operatingModeSchema.safeParse(mode);
  if (!parsed.success) {
    return { error: "Invalid mode." };
  }

  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return { error: "No location assigned." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("locations")
    .update({
      denis_operating_mode: parsed.data,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", locationId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/denis");
  return { success: true, mode: parsed.data };
}

export async function setDenisKdsStress(stress: "normal" | "high") {
  const staff = await requireStaff();
  if (!["owner", "manager"].includes(staff.role)) {
    return { error: "Not allowed." };
  }

  const locationId = await getStaffLocationId(staff);
  if (!locationId) {
    return { error: "No location assigned." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("locations")
    .update({
      denis_kds_stress: stress,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", locationId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/denis");
  return { success: true, stress };
}

export async function upsertDenisStaffTableHint(input: {
  tableId: string;
  text: string;
  visibility?: "denis_only" | "guest_safe";
  expiresInMinutes?: number;
}) {
  const staff = await requireStaff();
  if (!["owner", "manager", "waiter"].includes(staff.role)) {
    return { error: "Not allowed." };
  }

  const parsed = tableHintSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input." };
  }

  const locationId = await getStaffLocationId(staff);
  if (!locationId || !isUuid(parsed.data.tableId)) {
    return { error: "Invalid table." };
  }

  const admin = createAdminClient();
  const { data: tableRow } = await admin
    .from("tables")
    .select("id")
    .eq("id", parsed.data.tableId)
    .eq("location_id", locationId)
    .maybeSingle();

  if (!tableRow) {
    return { error: "Table not found." };
  }

  const expiresAt = new Date(
    Date.now() + parsed.data.expiresInMinutes * 60_000
  ).toISOString();

  await admin
    .from("denis_staff_table_hints" as never)
    .update({ revoked_at: new Date().toISOString() } as never)
    .eq("location_id", locationId)
    .eq("table_id", parsed.data.tableId)
    .is("revoked_at", null);

  const { data, error } = await admin
    .from("denis_staff_table_hints" as never)
    .insert({
      location_id: locationId,
      table_id: parsed.data.tableId,
      text: parsed.data.text,
      visibility: parsed.data.visibility,
      expires_at: expiresAt,
      created_by_staff_id: staff.id,
    } as never)
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/denis");
  return { success: true, hintId: (data as { id: string }).id };
}

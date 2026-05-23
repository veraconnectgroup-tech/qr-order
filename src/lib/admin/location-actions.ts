"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth/session";
import {
  zOptionalSanitizedText,
  zSanitizedText,
  zUuid,
} from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";

const locationSchema = z.object({
  name: zSanitizedText(200).pipe(z.string().min(1)),
  address: zOptionalSanitizedText(500),
  city: zOptionalSanitizedText(120),
  postal_code: zOptionalSanitizedText(20),
});

const locationUpdateSchema = locationSchema.extend({
  is_active: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((value) =>
      value === undefined ? undefined : value === true || value === "true"
    ),
});

export async function createLocation(formData: FormData) {
  const staff = await requireOwner();
  const parsed = locationSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address"),
    city: formData.get("city"),
    postal_code: formData.get("postal_code"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("locations")
    .insert({
      org_id: staff.org_id,
      name: parsed.data.name,
      address: parsed.data.address ?? null,
      city: parsed.data.city ?? null,
      postal_code: parsed.data.postal_code ?? null,
      is_active: true,
    } as never)
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Could not create location." };
  }

  revalidatePath("/admin/locations");
  return { data: { id: (data as { id: string }).id } };
}

export async function updateLocation(locationId: string, formData: FormData) {
  const staff = await requireOwner();
  if (!zUuid().safeParse(locationId).success) {
    return { error: "Invalid location." };
  }

  const parsed = locationUpdateSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address"),
    city: formData.get("city"),
    postal_code: formData.get("postal_code"),
    is_active: formData.get("is_active"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("locations")
    .select("id")
    .eq("id", locationId)
    .eq("org_id", staff.org_id)
    .maybeSingle();

  if (!existing) {
    return { error: "Location not found." };
  }

  const patch: Record<string, unknown> = {
    name: parsed.data.name,
    address: parsed.data.address ?? null,
    city: parsed.data.city ?? null,
    postal_code: parsed.data.postal_code ?? null,
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.is_active !== undefined) {
    patch.is_active = parsed.data.is_active;
  }

  const { error } = await admin
    .from("locations")
    .update(patch as never)
    .eq("id", locationId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/locations");
  return { ok: true as const };
}

export async function setLocationActive(locationId: string, isActive: boolean) {
  const staff = await requireOwner();
  if (!zUuid().safeParse(locationId).success) {
    return { error: "Invalid location." };
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("locations")
    .select("id")
    .eq("id", locationId)
    .eq("org_id", staff.org_id)
    .maybeSingle();

  if (!existing) {
    return { error: "Location not found." };
  }

  const { error } = await admin
    .from("locations")
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", locationId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/locations");
  return { ok: true as const };
}

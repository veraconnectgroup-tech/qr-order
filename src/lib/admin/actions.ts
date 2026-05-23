"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, getStaffLocationId } from "@/lib/auth/session";
import {
  zOptionalSanitizedText,
  zSanitizedText,
  zUuid,
} from "@/lib/security/zod-fields";
import { createServerClient } from "@/lib/supabase/server";

const categorySchema = z.object({
  name: zSanitizedText(200).pipe(z.string().min(1)),
  name_en: zOptionalSanitizedText(200),
  description: zOptionalSanitizedText(2000),
  sort_order: z.coerce.number().default(0),
});

const productSchema = z.object({
  name: zSanitizedText(200).pipe(z.string().min(1)),
  description: zOptionalSanitizedText(5000),
  price: z.coerce.number().positive(),
  category_id: zUuid().optional().nullable(),
  is_available: z.coerce.boolean().default(true),
  prep_time_minutes: z.coerce.number().optional().nullable(),
});

const tableSchema = z.object({
  name: zSanitizedText(100).pipe(z.string().min(1)),
  zone_id: zUuid().optional().nullable(),
  seats: z.coerce.number().min(1).max(50).default(4),
});

export async function createCategory(formData: FormData) {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) return { error: "Lokacija nije pronađena." };

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    name_en: formData.get("name_en") || undefined,
    description: formData.get("description") || undefined,
    sort_order: formData.get("sort_order") || 0,
  });

  if (!parsed.success) return { error: "Neispravni podaci." };

  const supabase = await createServerClient();
  const { error } = await supabase.from("categories").insert({
    location_id: locationId,
    ...parsed.data,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/categories");
  return { success: true };
}

export async function deleteCategory(id: string) {
  await requireAdmin();
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("categories")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/categories");
  return { success: true };
}

export async function createProduct(formData: FormData) {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) return { error: "Lokacija nije pronađena." };

  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    price: formData.get("price"),
    category_id: formData.get("category_id") || null,
    is_available: formData.get("is_available") === "true",
    prep_time_minutes: formData.get("prep_time_minutes") || null,
  });

  if (!parsed.success) return { error: "Neispravni podaci." };

  const supabase = await createServerClient();
  const { error } = await supabase.from("products").insert({
    location_id: locationId,
    ...parsed.data,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/menu");
  return { success: true };
}

export async function toggleProductAvailability(id: string, available: boolean) {
  await requireAdmin();
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("products")
    .update({ is_available: available })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin/menu");
  return { success: true };
}

export async function createTable(formData: FormData) {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) return { error: "Lokacija nije pronađena." };

  const parsed = tableSchema.safeParse({
    name: formData.get("name"),
    zone_id: formData.get("zone_id") || null,
    seats: formData.get("seats") || 4,
  });

  if (!parsed.success) return { error: "Neispravni podaci." };

  const supabase = await createServerClient();
  const { error } = await supabase.from("tables").insert({
    location_id: locationId,
    ...parsed.data,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/tables");
  return { success: true };
}

export async function createZone(formData: FormData) {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) return { error: "Lokacija nije pronađena." };

  const nameRaw = formData.get("name");
  const parsedName = zSanitizedText(100).pipe(z.string().min(1)).safeParse(nameRaw);
  if (!parsedName.success) return { error: "Unesite naziv zone." };

  const supabase = await createServerClient();
  const { error } = await supabase.from("zones").insert({
    location_id: locationId,
    name: parsedName.data,
  });

  if (error) return { error: error.message };
  revalidatePath("/admin/tables");
  return { success: true };
}

export async function assignTableStaff(tableId: string, staffId: string | null) {
  const adminStaff = await requireAdmin();
  const locationId = await getStaffLocationId(adminStaff);
  if (!locationId) return { error: "Lokacija nije pronađena." };

  const supabase = await createServerClient();
  const { data: table } = await supabase
    .from("tables")
    .select("id, location_id")
    .eq("id", tableId)
    .single();

  if (!table || (table as { location_id: string }).location_id !== locationId) {
    return { error: "Sto nije pronađen." };
  }

  const { error } = await supabase
    .from("tables")
    .update({ assigned_staff_id: staffId } as never)
    .eq("id", tableId);

  if (error) return { error: error.message };
  revalidatePath("/admin/tables");
  return { success: true };
}

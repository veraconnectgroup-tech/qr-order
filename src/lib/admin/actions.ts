"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auditLog } from "@/lib/audit/log";
import { requireAdmin, getStaffLocationId } from "@/lib/auth/session";
import {
  normalizeAllergenId,
  type AllergenId,
} from "@/lib/allergens";
import { normalizeScheduleDays } from "@/lib/menu/schedule";
import { MENU_SECTIONS } from "@/lib/menu-section";
import {
  zOptionalSanitizedText,
  zSanitizedText,
  zUuid,
} from "@/lib/security/zod-fields";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/storage/upload-product-image";
import { createServerClient } from "@/lib/supabase/server";

const categorySchema = z.object({
  name: zSanitizedText(200).pipe(z.string().min(1)),
  name_en: zOptionalSanitizedText(200),
  description: zOptionalSanitizedText(2000),
  sort_order: z.coerce.number().default(0),
  menu_section: z.enum(MENU_SECTIONS).optional(),
  schedule_enabled: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) =>
      v === undefined ? undefined : v === true || v === "true"
    ),
  schedule_start: zOptionalSanitizedText(10),
  schedule_end: zOptionalSanitizedText(10),
  schedule_days: z.string().optional(),
});

const categoryUpdateSchema = z.object({
  name: zSanitizedText(200).pipe(z.string().min(1)).optional(),
  name_en: zOptionalSanitizedText(200),
  description: zOptionalSanitizedText(2000),
  menu_section: z.enum(MENU_SECTIONS).optional(),
  schedule_enabled: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) =>
      v === undefined ? undefined : v === true || v === "true"
    ),
  schedule_start: zOptionalSanitizedText(10),
  schedule_end: zOptionalSanitizedText(10),
  schedule_days: z.string().optional(),
});

const productSchema = z.object({
  name: zSanitizedText(200).pipe(z.string().min(1)),
  description: zOptionalSanitizedText(5000),
  price: z.coerce.number().positive(),
  category_id: zUuid().optional().nullable(),
  is_available: z.coerce.boolean().default(true),
  prep_time_minutes: z.coerce.number().optional().nullable(),
});

const productUpdateSchema = z.object({
  name: zSanitizedText(200).pipe(z.string().min(1)).optional(),
  description: zOptionalSanitizedText(5000),
  price: z.coerce.number().positive().optional(),
  category_id: zUuid().optional().nullable(),
  is_available: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) =>
      v === undefined ? undefined : v === true || v === "true"
    ),
  prep_time_minutes: z.coerce.number().optional().nullable(),
  tax_rate: z.coerce.number().min(0).max(100).optional().nullable(),
  allergens: z.string().optional(),
  image_url: zOptionalSanitizedText(2000),
});

const tableSchema = z.object({
  name: zSanitizedText(100).pipe(z.string().min(1)),
  zone_id: zUuid().optional().nullable(),
  seats: z.coerce.number().min(1).max(50).default(4),
});

const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function getAdminContext() {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) return { error: "Location not found." as const };
  return { staff, locationId };
}

async function assertProductInLocation(productId: string, locationId: string) {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("products")
    .select("id, image_url")
    .eq("id", productId)
    .eq("location_id", locationId)
    .is("deleted_at", null)
    .maybeSingle();
  return data as { id: string; image_url: string | null } | null;
}

async function assertProductsInLocation(ids: string[], locationId: string) {
  if (!ids.length) return false;
  const supabase = await createServerClient();
  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .in("id", ids)
    .eq("location_id", locationId)
    .is("deleted_at", null);
  return count === ids.length;
}

function parseAllergens(raw: string | undefined): string[] | null | undefined {
  if (raw === undefined) return undefined;
  if (!raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const ids = parsed
      .map((v) => (typeof v === "string" ? normalizeAllergenId(v) : null))
      .filter((v): v is AllergenId => v != null);
    return ids.length ? ids : null;
  } catch {
    return null;
  }
}

function parseScheduleDays(raw: string | undefined): number[] | undefined {
  if (raw === undefined) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    return normalizeScheduleDays(
      parsed.filter((v): v is number => typeof v === "number")
    );
  } catch {
    return undefined;
  }
}

function imageExtension(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && ["jpg", "jpeg", "png", "webp"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

function storagePathFromPublicUrl(publicUrl: string): string | null {
  const marker = `/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/`;
  const index = publicUrl.indexOf(marker);
  if (index === -1) return null;
  return publicUrl.slice(index + marker.length);
}

export async function createCategory(formData: FormData) {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) return { error: "Location not found." };

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    name_en: formData.get("name_en") || undefined,
    description: formData.get("description") || undefined,
    sort_order: formData.get("sort_order") || 0,
    menu_section: formData.get("menu_section") || undefined,
    schedule_enabled: formData.has("schedule_enabled")
      ? formData.get("schedule_enabled")
      : undefined,
    schedule_start: formData.get("schedule_start") || undefined,
    schedule_end: formData.get("schedule_end") || undefined,
    schedule_days: formData.get("schedule_days") || undefined,
  });

  if (!parsed.success) return { error: "Invalid data." };

  const supabase = await createServerClient();
  const { data: maxRow } = await supabase
    .from("categories")
    .select("sort_order")
    .eq("location_id", locationId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSort =
    ((maxRow as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  const insert: Record<string, unknown> = {
    location_id: locationId,
    name: parsed.data.name,
    name_en: parsed.data.name_en ?? null,
    description: parsed.data.description ?? null,
    sort_order: nextSort,
    menu_section: parsed.data.menu_section ?? "food",
  };

  if (parsed.data.schedule_enabled !== undefined) {
    insert.schedule_enabled = parsed.data.schedule_enabled;
    if (!parsed.data.schedule_enabled) {
      insert.schedule_start = null;
      insert.schedule_end = null;
      insert.schedule_days = normalizeScheduleDays([1, 2, 3, 4, 5, 6, 0]);
    } else {
      insert.schedule_start = parsed.data.schedule_start ?? null;
      insert.schedule_end = parsed.data.schedule_end ?? null;
      const days = parseScheduleDays(parsed.data.schedule_days);
      insert.schedule_days = days ?? normalizeScheduleDays([1, 2, 3, 4, 5, 6, 0]);
    }
  }

  const { error } = await supabase.from("categories").insert(insert);

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
  if (!locationId) return { error: "Location not found." };

  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    price: formData.get("price"),
    category_id: formData.get("category_id") || null,
    is_available: formData.get("is_available") === "true",
    prep_time_minutes: formData.get("prep_time_minutes") || null,
  });

  if (!parsed.success) return { error: "Invalid data." };

  const supabase = await createServerClient();
  const { data: created, error } = await supabase
    .from("products")
    .insert({
      location_id: locationId,
      ...parsed.data,
    })
    .select("id, name, price")
    .single();

  if (error) return { error: error.message };

  await auditLog({
    orgId: staff.org_id,
    userId: staff.user_id,
    action: "create",
    entityType: "product",
    entityId: (created as { id: string }).id,
    newValue: created,
  });

  revalidatePath("/admin/menu");
  return { success: true };
}

export async function toggleProductAvailability(id: string, available: boolean) {
  const staff = await requireAdmin();
  const supabase = await createServerClient();

  const { data: existing } = await supabase
    .from("products")
    .select("id, name, is_available, location_id")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("products")
    .update({ is_available: available })
    .eq("id", id);

  if (error) return { error: error.message };

  if (existing) {
    await auditLog({
      orgId: staff.org_id,
      userId: staff.user_id,
      action: "update",
      entityType: "product",
      entityId: id,
      oldValue: { is_available: (existing as { is_available: boolean }).is_available },
      newValue: { is_available: available },
    });
  }

  revalidatePath("/admin/menu");
  return { success: true };
}

export async function createTable(formData: FormData) {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) return { error: "Location not found." };

  const parsed = tableSchema.safeParse({
    name: formData.get("name"),
    zone_id: formData.get("zone_id") || null,
    seats: formData.get("seats") || 4,
  });

  if (!parsed.success) return { error: "Invalid data." };

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
  if (!locationId) return { error: "Location not found." };

  const nameRaw = formData.get("name");
  const parsedName = zSanitizedText(100).pipe(z.string().min(1)).safeParse(nameRaw);
  if (!parsedName.success) return { error: "Enter a zone name." };

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
  if (!locationId) return { error: "Location not found." };

  const supabase = await createServerClient();
  const { data: table } = await supabase
    .from("tables")
    .select("id, location_id")
    .eq("id", tableId)
    .single();

  if (!table || (table as { location_id: string }).location_id !== locationId) {
    return { error: "Table not found." };
  }

  const { error } = await supabase
    .from("tables")
    .update({ assigned_staff_id: staffId } as never)
    .eq("id", tableId);

  if (error) return { error: error.message };
  revalidatePath("/admin/tables");
  return { success: true };
}

export async function updateCategory(id: string, formData: FormData) {
  const ctx = await getAdminContext();
  if ("error" in ctx) return ctx;

  const parsed = categoryUpdateSchema.safeParse({
    name: formData.get("name") || undefined,
    name_en: formData.get("name_en") || undefined,
    description: formData.get("description") || undefined,
    menu_section: formData.get("menu_section") || undefined,
    schedule_enabled: formData.has("schedule_enabled")
      ? formData.get("schedule_enabled")
      : undefined,
    schedule_start: formData.get("schedule_start") || undefined,
    schedule_end: formData.get("schedule_end") || undefined,
    schedule_days: formData.get("schedule_days") || undefined,
  });

  if (!parsed.success) return { error: "Invalid data." };

  const supabase = await createServerClient();
  const { data: category } = await supabase
    .from("categories")
    .select("id")
    .eq("id", id)
    .eq("location_id", ctx.locationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!category) return { error: "Category not found." };

  const patch: {
    name?: string;
    name_en?: string | null;
    description?: string | null;
    menu_section?: string;
    schedule_enabled?: boolean;
    schedule_start?: string | null;
    schedule_end?: string | null;
    schedule_days?: number[];
  } = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.name_en !== undefined) patch.name_en = parsed.data.name_en ?? null;
  if (parsed.data.description !== undefined) {
    patch.description = parsed.data.description ?? null;
  }
  if (parsed.data.menu_section !== undefined) {
    patch.menu_section = parsed.data.menu_section;
  }

  if (parsed.data.schedule_enabled !== undefined) {
    patch.schedule_enabled = parsed.data.schedule_enabled;
    if (!parsed.data.schedule_enabled) {
      patch.schedule_start = null;
      patch.schedule_end = null;
      patch.schedule_days = normalizeScheduleDays([1, 2, 3, 4, 5, 6, 0]);
    } else {
      patch.schedule_start = parsed.data.schedule_start ?? null;
      patch.schedule_end = parsed.data.schedule_end ?? null;
      const days = parseScheduleDays(parsed.data.schedule_days);
      if (days) patch.schedule_days = days;
    }
  }

  const { error } = await supabase.from("categories").update(patch).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/categories");
  revalidatePath("/admin/menu");
  return { success: true };
}

export async function reorderCategories(orderedIds: string[]) {
  const ctx = await getAdminContext();
  if ("error" in ctx) return ctx;

  const supabase = await createServerClient();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("categories")
      .update({ sort_order: i })
      .eq("id", orderedIds[i])
      .eq("location_id", ctx.locationId);
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/categories");
  return { success: true };
}

export async function updateProduct(id: string, formData: FormData) {
  const ctx = await getAdminContext();
  if ("error" in ctx) return ctx;

  const product = await assertProductInLocation(id, ctx.locationId);
  if (!product) return { error: "Product not found." };

  const supabase = await createServerClient();
  const { data: beforeRow } = await supabase
    .from("products")
    .select("id, name, price, is_available, tax_rate, category_id")
    .eq("id", id)
    .single();

  const parsed = productUpdateSchema.safeParse({
    name: formData.get("name") || undefined,
    description: formData.get("description") || undefined,
    price: formData.has("price") ? formData.get("price") : undefined,
    category_id: formData.has("category_id")
      ? formData.get("category_id") || null
      : undefined,
    is_available: formData.has("is_available")
      ? formData.get("is_available")
      : undefined,
    prep_time_minutes: formData.has("prep_time_minutes")
      ? formData.get("prep_time_minutes") || null
      : undefined,
    tax_rate: formData.has("tax_rate")
      ? formData.get("tax_rate") || null
      : undefined,
    allergens: formData.has("allergens") ? formData.get("allergens") : undefined,
    image_url: formData.has("image_url")
      ? formData.get("image_url") || null
      : undefined,
  });

  if (!parsed.success) return { error: "Invalid data." };

  const allergens = parseAllergens(parsed.data.allergens);
  const patch: {
    name?: string;
    description?: string | null;
    price?: number;
    category_id?: string | null;
    is_available?: boolean;
    prep_time_minutes?: number | null;
    tax_rate?: number | null;
    allergens?: string[] | null;
    image_url?: string | null;
  } = {};

  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.description !== undefined) {
    patch.description = parsed.data.description ?? null;
  }
  if (parsed.data.price !== undefined) patch.price = parsed.data.price;
  if (parsed.data.category_id !== undefined) patch.category_id = parsed.data.category_id;
  if (parsed.data.is_available !== undefined) {
    patch.is_available = parsed.data.is_available;
  }
  if (parsed.data.prep_time_minutes !== undefined) {
    patch.prep_time_minutes = parsed.data.prep_time_minutes;
  }
  if (parsed.data.tax_rate !== undefined) patch.tax_rate = parsed.data.tax_rate;
  if (allergens !== undefined) patch.allergens = allergens;
  if (parsed.data.image_url !== undefined) patch.image_url = parsed.data.image_url;

  const { error } = await supabase.from("products").update(patch).eq("id", id);
  if (error) return { error: error.message };

  const before = beforeRow as {
    id: string;
    name: string;
    price: number;
    is_available: boolean;
    tax_rate: number | null;
    category_id: string | null;
  } | null;

  await auditLog({
    orgId: ctx.staff.org_id,
    userId: ctx.staff.user_id,
    action: "update",
    entityType: "product",
    entityId: id,
    oldValue: before ?? undefined,
    newValue: patch,
  });

  revalidatePath("/admin/menu");
  return { success: true };
}

export async function deleteProduct(id: string) {
  const ctx = await getAdminContext();
  if ("error" in ctx) return ctx;

  const product = await assertProductInLocation(id, ctx.locationId);
  if (!product) return { error: "Product not found." };

  const supabase = await createServerClient();
  const { data: beforeRow } = await supabase
    .from("products")
    .select("id, name, price")
    .eq("id", id)
    .single();

  const { data: groups } = await supabase
    .from("modifier_groups")
    .select("id")
    .eq("product_id", id);

  const groupIds = ((groups ?? []) as Array<{ id: string }>).map((g) => g.id);
  if (groupIds.length) {
    await supabase
      .from("modifiers")
      .update({ is_available: false })
      .in("group_id", groupIds);
    await supabase.from("modifier_groups").delete().in("id", groupIds);
  }

  const { error } = await supabase
    .from("products")
    .update({ deleted_at: new Date().toISOString(), is_available: false })
    .eq("id", id);

  if (error) return { error: error.message };

  await auditLog({
    orgId: ctx.staff.org_id,
    userId: ctx.staff.user_id,
    action: "delete",
    entityType: "product",
    entityId: id,
    oldValue: beforeRow ?? undefined,
  });

  revalidatePath("/admin/menu");
  return { success: true };
}

export async function uploadProductImage(id: string, formData: FormData) {
  const ctx = await getAdminContext();
  if ("error" in ctx) return ctx;

  const product = await assertProductInLocation(id, ctx.locationId);
  if (!product) return { error: "Product not found." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "No image file provided." };
  }
  if (!IMAGE_TYPES.has(file.type)) {
    return { error: "Use JPG, PNG, or WebP (max 2 MB)." };
  }
  if (file.size > IMAGE_MAX_BYTES) {
    return { error: "Image is too large. Maximum size is 2 MB." };
  }

  const ext = imageExtension(file);
  const path = `${ctx.staff.org_id}/${id}.${ext}`;
  const supabase = await createServerClient();

  if (product.image_url) {
    const oldPath = storagePathFromPublicUrl(product.image_url);
    if (oldPath) {
      await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([oldPath]);
    }
  }

  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) return { error: uploadError.message };

  const { data } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path);
  const cacheBust = `${data.publicUrl}?v=${Date.now()}`;

  const { error } = await supabase
    .from("products")
    .update({ image_url: cacheBust })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/menu");
  return { success: true, url: cacheBust };
}

export async function reorderProducts(categoryId: string, orderedIds: string[]) {
  const ctx = await getAdminContext();
  if ("error" in ctx) return ctx;

  const supabase = await createServerClient();
  const { data: category } = await supabase
    .from("categories")
    .select("id")
    .eq("id", categoryId)
    .eq("location_id", ctx.locationId)
    .maybeSingle();

  if (!category) return { error: "Category not found." };

  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("products")
      .update({ sort_order: i })
      .eq("id", orderedIds[i])
      .eq("category_id", categoryId)
      .eq("location_id", ctx.locationId);
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/menu");
  return { success: true };
}

export async function bulkToggleAvailability(ids: string[], available: boolean) {
  const ctx = await getAdminContext();
  if ("error" in ctx) return ctx;
  if (!ids.length) return { error: "No products selected." };

  if (!(await assertProductsInLocation(ids, ctx.locationId))) {
    return { error: "One or more products not found." };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("products")
    .update({ is_available: available })
    .in("id", ids);

  if (error) return { error: error.message };
  revalidatePath("/admin/menu");
  return { success: true };
}

export async function bulkDeleteProducts(ids: string[]) {
  const ctx = await getAdminContext();
  if ("error" in ctx) return ctx;
  if (!ids.length) return { error: "No products selected." };

  for (const id of ids) {
    const result = await deleteProduct(id);
    if (result?.error) return result;
  }

  return { success: true };
}

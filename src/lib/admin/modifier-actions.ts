"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, getStaffLocationId } from "@/lib/auth/session";
import { zSanitizedText, zUuid } from "@/lib/security/zod-fields";
import { createServerClient } from "@/lib/supabase/server";

const groupSchema = z
  .object({
    product_id: zUuid(),
    name: zSanitizedText(200).pipe(z.string().min(1)),
    min_select: z.coerce.number().int().min(0).default(0),
    max_select: z.coerce.number().int().min(1).default(1),
  })
  .refine((d) => d.max_select >= d.min_select, {
    message: "max_select must be >= min_select",
  });

const groupUpdateSchema = z
  .object({
    name: zSanitizedText(200).pipe(z.string().min(1)).optional(),
    min_select: z.coerce.number().int().min(0).optional(),
    max_select: z.coerce.number().int().min(1).optional(),
  })
  .refine(
    (d) =>
      d.min_select === undefined ||
      d.max_select === undefined ||
      d.max_select >= d.min_select,
    { message: "max_select must be >= min_select" }
  );

const modifierSchema = z.object({
  group_id: zUuid(),
  name: zSanitizedText(200).pipe(z.string().min(1)),
  price: z.coerce.number().min(0).default(0),
  is_default: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "true"),
});

const modifierUpdateSchema = z.object({
  name: zSanitizedText(200).pipe(z.string().min(1)).optional(),
  price: z.coerce.number().min(0).optional(),
  is_default: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) =>
      v === undefined ? undefined : v === true || v === "true"
    ),
  is_available: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) =>
      v === undefined ? undefined : v === true || v === "true"
    ),
});

async function getAdminLocationId() {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) return { error: "Location not found." as const };
  return { staff, locationId };
}

async function assertProductInLocation(productId: string, locationId: string) {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .eq("location_id", locationId)
    .is("deleted_at", null)
    .maybeSingle();
  return Boolean(data);
}

async function assertGroupInLocation(groupId: string, locationId: string) {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("modifier_groups")
    .select("product_id")
    .eq("id", groupId)
    .maybeSingle();
  if (!data) return false;
  return assertProductInLocation(
    (data as { product_id: string }).product_id,
    locationId
  );
}

async function assertModifierInLocation(modifierId: string, locationId: string) {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("modifiers")
    .select("group_id")
    .eq("id", modifierId)
    .maybeSingle();
  if (!data) return false;
  return assertGroupInLocation(
    (data as { group_id: string }).group_id,
    locationId
  );
}

function revalidateMenu() {
  revalidatePath("/admin/menu");
}

export async function createModifierGroup(formData: FormData) {
  const ctx = await getAdminLocationId();
  if ("error" in ctx) return ctx;

  const parsed = groupSchema.safeParse({
    product_id: formData.get("product_id"),
    name: formData.get("name"),
    min_select: formData.get("min_select") ?? 0,
    max_select: formData.get("max_select") ?? 1,
  });
  if (!parsed.success) return { error: "Invalid data." };

  if (!(await assertProductInLocation(parsed.data.product_id, ctx.locationId))) {
    return { error: "Product not found." };
  }

  const supabase = await createServerClient();
  const { data: maxRow } = await supabase
    .from("modifier_groups")
    .select("sort_order")
    .eq("product_id", parsed.data.product_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSort =
    ((maxRow as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  const { error } = await supabase.from("modifier_groups").insert({
    product_id: parsed.data.product_id,
    name: parsed.data.name,
    min_select: parsed.data.min_select,
    max_select: parsed.data.max_select,
    is_required: parsed.data.min_select > 0,
    sort_order: nextSort,
  });

  if (error) return { error: error.message };
  revalidateMenu();
  return { success: true };
}

export async function updateModifierGroup(groupId: string, formData: FormData) {
  const ctx = await getAdminLocationId();
  if ("error" in ctx) return ctx;

  if (!(await assertGroupInLocation(groupId, ctx.locationId))) {
    return { error: "Group not found." };
  }

  const parsed = groupUpdateSchema.safeParse({
    name: formData.get("name") || undefined,
    min_select: formData.has("min_select")
      ? formData.get("min_select")
      : undefined,
    max_select: formData.has("max_select")
      ? formData.get("max_select")
      : undefined,
  });
  if (!parsed.success) return { error: "Invalid data." };

  const patch: {
    name?: string;
    min_select?: number;
    max_select?: number;
    is_required?: boolean;
  } = { ...parsed.data };
  if (parsed.data.min_select !== undefined) {
    patch.is_required = parsed.data.min_select > 0;
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("modifier_groups")
    .update(patch)
    .eq("id", groupId);

  if (error) return { error: error.message };
  revalidateMenu();
  return { success: true };
}

export async function deleteModifierGroup(groupId: string) {
  const ctx = await getAdminLocationId();
  if ("error" in ctx) return ctx;

  if (!(await assertGroupInLocation(groupId, ctx.locationId))) {
    return { error: "Group not found." };
  }

  const supabase = await createServerClient();
  await supabase
    .from("modifiers")
    .update({ is_available: false })
    .eq("group_id", groupId);

  const { error } = await supabase
    .from("modifier_groups")
    .delete()
    .eq("id", groupId);

  if (error) return { error: error.message };
  revalidateMenu();
  return { success: true };
}

export async function reorderModifierGroups(
  productId: string,
  orderedIds: string[]
) {
  const ctx = await getAdminLocationId();
  if ("error" in ctx) return ctx;

  if (!(await assertProductInLocation(productId, ctx.locationId))) {
    return { error: "Product not found." };
  }

  const supabase = await createServerClient();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("modifier_groups")
      .update({ sort_order: i })
      .eq("id", orderedIds[i])
      .eq("product_id", productId);
    if (error) return { error: error.message };
  }

  revalidateMenu();
  return { success: true };
}

async function setModifierAsDefault(groupId: string, modifierId: string) {
  const supabase = await createServerClient();
  const { data: siblings } = await supabase
    .from("modifiers")
    .select("id, sort_order")
    .eq("group_id", groupId)
    .order("sort_order");

  const list = (siblings ?? []) as Array<{ id: string; sort_order: number }>;
  const others = list.filter((m) => m.id !== modifierId);
  for (let i = 0; i < others.length; i++) {
    await supabase
      .from("modifiers")
      .update({ sort_order: i + 1 })
      .eq("id", others[i].id);
  }
  await supabase
    .from("modifiers")
    .update({ sort_order: 0 })
    .eq("id", modifierId);
}

export async function createModifier(formData: FormData) {
  const ctx = await getAdminLocationId();
  if ("error" in ctx) return ctx;

  const parsed = modifierSchema.safeParse({
    group_id: formData.get("group_id"),
    name: formData.get("name"),
    price: formData.get("price") ?? 0,
    is_default: formData.get("is_default"),
  });
  if (!parsed.success) return { error: "Invalid data." };

  if (!(await assertGroupInLocation(parsed.data.group_id, ctx.locationId))) {
    return { error: "Group not found." };
  }

  const supabase = await createServerClient();
  const { data: maxRow } = await supabase
    .from("modifiers")
    .select("sort_order")
    .eq("group_id", parsed.data.group_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  let sortOrder =
    ((maxRow as { sort_order: number } | null)?.sort_order ?? -1) + 1;
  if (parsed.data.is_default) sortOrder = 0;

  const { data: inserted, error } = await supabase
    .from("modifiers")
    .insert({
      group_id: parsed.data.group_id,
      name: parsed.data.name,
      price: parsed.data.price,
      sort_order: sortOrder,
      is_available: true,
    })
    .select("id")
    .single();

  if (error || !inserted) return { error: error?.message ?? "Insert failed." };

  if (parsed.data.is_default) {
    await setModifierAsDefault(parsed.data.group_id, inserted.id);
  }

  revalidateMenu();
  return { success: true };
}

export async function updateModifier(modifierId: string, formData: FormData) {
  const ctx = await getAdminLocationId();
  if ("error" in ctx) return ctx;

  if (!(await assertModifierInLocation(modifierId, ctx.locationId))) {
    return { error: "Modifier not found." };
  }

  const parsed = modifierUpdateSchema.safeParse({
    name: formData.get("name") || undefined,
    price: formData.has("price") ? formData.get("price") : undefined,
    is_default: formData.has("is_default")
      ? formData.get("is_default")
      : undefined,
    is_available: formData.has("is_available")
      ? formData.get("is_available")
      : undefined,
  });
  if (!parsed.success) return { error: "Invalid data." };

  const supabase = await createServerClient();
  const { is_default, ...patch } = parsed.data;

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase
      .from("modifiers")
      .update(patch)
      .eq("id", modifierId);
    if (error) return { error: error.message };
  }

  if (is_default === true) {
    const { data: mod } = await supabase
      .from("modifiers")
      .select("group_id")
      .eq("id", modifierId)
      .single();
    if (mod) {
      await setModifierAsDefault(
        (mod as { group_id: string }).group_id,
        modifierId
      );
    }
  }

  revalidateMenu();
  return { success: true };
}

export async function deleteModifier(modifierId: string) {
  const ctx = await getAdminLocationId();
  if ("error" in ctx) return ctx;

  if (!(await assertModifierInLocation(modifierId, ctx.locationId))) {
    return { error: "Modifier not found." };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("modifiers")
    .update({ is_available: false })
    .eq("id", modifierId);

  if (error) return { error: error.message };
  revalidateMenu();
  return { success: true };
}

export async function reorderModifiers(groupId: string, orderedIds: string[]) {
  const ctx = await getAdminLocationId();
  if ("error" in ctx) return ctx;

  if (!(await assertGroupInLocation(groupId, ctx.locationId))) {
    return { error: "Group not found." };
  }

  const supabase = await createServerClient();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("modifiers")
      .update({ sort_order: i })
      .eq("id", orderedIds[i])
      .eq("group_id", groupId);
    if (error) return { error: error.message };
  }

  revalidateMenu();
  return { success: true };
}

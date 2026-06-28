import type { SupabaseClient } from "@supabase/supabase-js";
import { invalidateMenuCache } from "@/lib/ai/menu-cache-invalidate";

export type CopyMenuResult = {
  categoriesCopied: number;
  productsCopied: number;
  modifierGroupsCopied: number;
  modifiersCopied: number;
};

type CategoryRow = {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  available_from: string | null;
  available_until: string | null;
  available_days: number[] | null;
};

type ProductRow = {
  id: string;
  category_id: string | null;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
  prep_time_minutes: number | null;
  allergens: string[] | null;
  tags: string[] | null;
  tax_rate: number | null;
};

type ModifierGroupRow = {
  id: string;
  product_id: string;
  name: string;
  name_en: string | null;
  min_select: number;
  max_select: number;
  is_required: boolean;
  sort_order: number;
};

type ModifierRow = {
  id: string;
  group_id: string;
  name: string;
  name_en: string | null;
  price: number;
  is_available: boolean;
  sort_order: number;
};

export async function copyMenuBetweenLocations(
  admin: SupabaseClient,
  input: {
    orgId: string;
    sourceLocationId: string;
    targetLocationId: string;
    replaceExisting?: boolean;
  }
): Promise<CopyMenuResult> {
  if (input.sourceLocationId === input.targetLocationId) {
    throw new Error("Source and target location must differ.");
  }

  for (const locationId of [input.sourceLocationId, input.targetLocationId]) {
    const { data } = await admin
      .from("locations")
      .select("id")
      .eq("id", locationId)
      .eq("org_id", input.orgId)
      .maybeSingle();
    if (!data) {
      throw new Error("Location not found in organization.");
    }
  }

  if (input.replaceExisting) {
    const { data: existingProducts } = await admin
      .from("products")
      .select("id")
      .eq("location_id", input.targetLocationId);

    const productIds = (existingProducts ?? []).map(
      (row) => (row as { id: string }).id
    );

    if (productIds.length) {
      const { data: groups } = await admin
        .from("modifier_groups")
        .select("id")
        .in("product_id", productIds);

      const groupIds = (groups ?? []).map((row) => (row as { id: string }).id);
      if (groupIds.length) {
        await admin.from("modifiers").delete().in("group_id", groupIds);
        await admin.from("modifier_groups").delete().in("id", groupIds);
      }

      await admin.from("products").delete().eq("location_id", input.targetLocationId);
    }

    await admin.from("categories").delete().eq("location_id", input.targetLocationId);
  }

  const { data: categories, error: catError } = await admin
    .from("categories")
    .select(
      "id, name, name_en, description, image_url, sort_order, is_active, available_from, available_until, available_days"
    )
    .eq("location_id", input.sourceLocationId)
    .order("sort_order");

  if (catError) {
    throw new Error(`Categories load failed: ${catError.message}`);
  }

  const categoryIdMap = new Map<string, string>();
  let categoriesCopied = 0;

  for (const raw of categories ?? []) {
    const cat = raw as CategoryRow;
    const { data: inserted, error } = await admin
      .from("categories")
      .insert({
        location_id: input.targetLocationId,
        name: cat.name,
        name_en: cat.name_en,
        description: cat.description,
        image_url: cat.image_url,
        sort_order: cat.sort_order,
        is_active: cat.is_active,
        available_from: cat.available_from,
        available_until: cat.available_until,
        available_days: cat.available_days,
      } as never)
      .select("id")
      .single();

    if (error || !inserted) {
      throw new Error(`Category copy failed: ${error?.message ?? "unknown"}`);
    }

    categoryIdMap.set(cat.id, (inserted as { id: string }).id);
    categoriesCopied += 1;
  }

  const { data: products, error: prodError } = await admin
    .from("products")
    .select(
      "id, category_id, name, name_en, description, description_en, price, image_url, is_available, sort_order, prep_time_minutes, allergens, tags, tax_rate"
    )
    .eq("location_id", input.sourceLocationId)
    .is("deleted_at", null)
    .order("sort_order");

  if (prodError) {
    throw new Error(`Products load failed: ${prodError.message}`);
  }

  const productIdMap = new Map<string, string>();
  let productsCopied = 0;
  let modifierGroupsCopied = 0;
  let modifiersCopied = 0;

  for (const raw of products ?? []) {
    const product = raw as ProductRow;
    const newCategoryId = product.category_id
      ? categoryIdMap.get(product.category_id) ?? null
      : null;

    const { data: inserted, error } = await admin
      .from("products")
      .insert({
        location_id: input.targetLocationId,
        category_id: newCategoryId,
        name: product.name,
        name_en: product.name_en,
        description: product.description,
        description_en: product.description_en,
        price: product.price,
        image_url: product.image_url,
        is_available: product.is_available,
        sort_order: product.sort_order,
        prep_time_minutes: product.prep_time_minutes,
        allergens: product.allergens,
        tags: product.tags,
        tax_rate: product.tax_rate,
      } as never)
      .select("id")
      .single();

    if (error || !inserted) {
      throw new Error(`Product copy failed: ${error?.message ?? "unknown"}`);
    }

    const newProductId = (inserted as { id: string }).id;
    productIdMap.set(product.id, newProductId);
    productsCopied += 1;

    const { data: groups } = await admin
      .from("modifier_groups")
      .select(
        "id, product_id, name, name_en, min_select, max_select, is_required, sort_order"
      )
      .eq("product_id", product.id)
      .order("sort_order");

    for (const groupRaw of groups ?? []) {
      const group = groupRaw as ModifierGroupRow;
      const { data: newGroup, error: groupError } = await admin
        .from("modifier_groups")
        .insert({
          product_id: newProductId,
          name: group.name,
          name_en: group.name_en,
          min_select: group.min_select,
          max_select: group.max_select,
          is_required: group.is_required,
          sort_order: group.sort_order,
        } as never)
        .select("id")
        .single();

      if (groupError || !newGroup) {
        throw new Error(
          `Modifier group copy failed: ${groupError?.message ?? "unknown"}`
        );
      }

      modifierGroupsCopied += 1;
      const newGroupId = (newGroup as { id: string }).id;

      const { data: mods } = await admin
        .from("modifiers")
        .select("id, group_id, name, name_en, price, is_available, sort_order")
        .eq("group_id", group.id)
        .order("sort_order");

      for (const modRaw of mods ?? []) {
        const mod = modRaw as ModifierRow;
        const { error: modError } = await admin.from("modifiers").insert({
          group_id: newGroupId,
          name: mod.name,
          name_en: mod.name_en,
          price: mod.price,
          is_available: mod.is_available,
          sort_order: mod.sort_order,
        } as never);

        if (modError) {
          throw new Error(`Modifier copy failed: ${modError.message}`);
        }
        modifiersCopied += 1;
      }
    }
  }

  await invalidateMenuCache(input.targetLocationId);

  return {
    categoriesCopied,
    productsCopied,
    modifierGroupsCopied,
    modifiersCopied,
  };
}

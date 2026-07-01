import type { Modifier, ModifierGroup } from "@/types";
import type { ProductWithModifiers } from "@/types";
import { createClient } from "@/lib/supabase/client";

type LoadedProductRow = {
  id: string;
  name: string;
  name_en: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  category_id: string | null;
  allergens: string[] | null;
  tax_rate: number | null;
  sort_order: number;
  modifier_groups?: Array<
    ModifierGroup & {
      modifiers?: Modifier[];
    }
  >;
};

const PRODUCT_SELECT =
  "id, name, name_en, price, image_url, is_available, category_id, allergens, tax_rate, sort_order, updated_at";

function normalizeLoadedProduct(
  row: LoadedProductRow,
  locationId: string
): ProductWithModifiers {
  const modifier_groups = (row.modifier_groups ?? [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((group) => ({
      ...group,
      modifiers: (group.modifiers ?? [])
        .filter((modifier) => modifier.is_available)
        .sort((a, b) => a.sort_order - b.sort_order),
    }))
    .filter((group) => group.modifiers.length > 0);

  return {
    id: row.id,
    location_id: locationId,
    category_id: row.category_id,
    name: row.name,
    name_en: row.name_en,
    description: null,
    description_en: null,
    price: row.price,
    image_url: row.image_url,
    is_available: row.is_available,
    track_stock: false,
    stock_quantity: null,
    prep_time_minutes: null,
    allergens: row.allergens,
    tags: null,
    sort_order: row.sort_order,
    requires_serve_size: false,
    serve_size_presets: null,
    allow_custom_serve_size: true,
    tax_rate: row.tax_rate,
    ai_description: null,
    deleted_at: null,
    created_at: "",
    updated_at: "",
    modifier_groups,
  };
}

export async function loadStaffMenuProducts(
  supabase: ReturnType<typeof createClient>,
  locationId: string
) {
  const { data: productsData } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("location_id", locationId)
    .eq("is_available", true)
    .is("deleted_at", null)
    .order("sort_order");

  const rows = (productsData as LoadedProductRow[]) ?? [];
  const productIds = rows.map((product) => product.id);

  const { data: modifierGroupsData } = productIds.length
    ? await supabase
        .from("modifier_groups")
        .select(
          "id, name, min_select, max_select, is_required, sort_order, product_id"
        )
        .in("product_id", productIds)
        .order("sort_order")
    : { data: [] };

  const groupIds = ((modifierGroupsData as ModifierGroup[]) ?? []).map(
    (group) => group.id
  );

  const { data: modifiersData } = groupIds.length
    ? await supabase
        .from("modifiers")
        .select("id, name, price, is_available, sort_order, group_id")
        .in("group_id", groupIds)
        .eq("is_available", true)
        .order("sort_order")
    : { data: [] };

  const modifiersByGroup = new Map<string, Modifier[]>();
  for (const modifier of (modifiersData as Modifier[]) ?? []) {
    const list = modifiersByGroup.get(modifier.group_id) ?? [];
    list.push(modifier);
    modifiersByGroup.set(modifier.group_id, list);
  }

  const groupsByProduct = new Map<
    string,
    Array<ModifierGroup & { modifiers: Modifier[] }>
  >();
  for (const group of (modifierGroupsData as ModifierGroup[]) ?? []) {
    const list = groupsByProduct.get(group.product_id) ?? [];
    list.push({
      ...group,
      modifiers: modifiersByGroup.get(group.id) ?? [],
    });
    groupsByProduct.set(group.product_id, list);
  }

  return rows.map((row) =>
    normalizeLoadedProduct(
      {
        ...row,
        modifier_groups: groupsByProduct.get(row.id) ?? [],
      },
      locationId
    )
  );
}

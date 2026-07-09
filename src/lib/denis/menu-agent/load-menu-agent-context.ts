import type { SupabaseClient } from "@supabase/supabase-js";

/** Compact "id | category | name | price" listing so the model can reference real ids, never invented ones. */
export async function loadMenuAgentContextBlock(
  admin: SupabaseClient,
  locationId: string
): Promise<string> {
  const [{ data: categories }, { data: products }] = await Promise.all([
    admin
      .from("categories")
      .select("id, name")
      .eq("location_id", locationId)
      .is("deleted_at", null)
      .order("sort_order"),
    admin
      .from("products")
      .select("id, name, price, category_id, is_available")
      .eq("location_id", locationId)
      .is("deleted_at", null)
      .order("sort_order"),
  ]);

  const categoryRows = (categories ?? []) as Array<{ id: string; name: string }>;
  const categoryNames = new Map(categoryRows.map((row) => [row.id, row.name]));

  const productRows = (products ?? []) as Array<{
    id: string;
    name: string;
    price: number;
    category_id: string | null;
    is_available: boolean;
  }>;

  const categoryLines = categoryRows
    .map((row) => `- ${row.id} | ${row.name}`)
    .join("\n");

  const productLines = productRows
    .map((row) => {
      const category = row.category_id
        ? (categoryNames.get(row.category_id) ?? "?")
        : "(no category)";
      const availability = row.is_available ? "" : " [unavailable]";
      return `- ${row.id} | ${category} | ${row.name} | ${row.price}${availability}`;
    })
    .join("\n");

  return [
    "CATEGORIES (id | name):",
    categoryLines || "(none)",
    "",
    "CURRENT MENU (id | category | name | price):",
    productLines || "(empty menu)",
  ].join("\n");
}

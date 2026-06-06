import type { SupabaseClient } from "@supabase/supabase-js";

export type ProactiveMenuHints = {
  todaySpecial: string | null;
  dessertProductName: string | null;
  popularityPair: { from: string; to: string } | null;
};

const POPULARITY_MIN_PAIR_COUNT = 8;

/** Lightweight menu hints for proactive templates (per location, cached per tick). */
export async function loadProactiveMenuHints(
  admin: SupabaseClient,
  locationId: string
): Promise<ProactiveMenuHints> {
  const [specialResult, dessertResult, pair] = await Promise.all([
    admin
      .from("products")
      .select("name")
      .eq("location_id", locationId)
      .eq("is_available", true)
      .not("ai_description", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("products")
      .select("name, category:categories(menu_section)")
      .eq("location_id", locationId)
      .eq("is_available", true)
      .order("name", { ascending: true })
      .limit(40),
    loadPopularityPair(admin, locationId),
  ]);

  const specialRow = specialResult.data as { name: string } | null;
  const dessertRows = (dessertResult.data ?? []) as unknown as Array<{
    name: string;
    category: { menu_section: string | null } | Array<{ menu_section: string | null }> | null;
  }>;

  const dessert = dessertRows.find((row) => {
    const category = Array.isArray(row.category) ? row.category[0] : row.category;
    return category?.menu_section === "desserts";
  });

  return {
    todaySpecial: specialRow?.name?.trim() ?? null,
    dessertProductName: dessert?.name?.trim() ?? null,
    popularityPair: pair,
  };
}

async function loadPopularityPair(
  admin: SupabaseClient,
  locationId: string
): Promise<{ from: string; to: string } | null> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const { data: orders, error } = await admin
    .from("orders")
    .select(
      `
      id,
      order_items (product_name)
    `
    )
    .eq("location_id", locationId)
    .gte("created_at", since)
    .in("status", ["delivered", "accepted", "preparing", "pending"])
    .limit(200);

  if (error || !orders?.length) return null;

  const pairCounts = new Map<string, number>();

  for (const order of orders as Array<{
    order_items: Array<{ product_name: string }> | null;
  }>) {
    const names = [
      ...new Set(
        (order.order_items ?? [])
          .map((item) => item.product_name?.trim())
          .filter((name): name is string => Boolean(name))
      ),
    ];
    if (names.length < 2) continue;

    for (let i = 0; i < names.length; i += 1) {
      for (let j = i + 1; j < names.length; j += 1) {
        const key = `${names[i]}::${names[j]}`;
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    }
  }

  let best: { from: string; to: string; count: number } | null = null;
  for (const [key, count] of pairCounts) {
    if (count < POPULARITY_MIN_PAIR_COUNT) continue;
    if (!best || count > best.count) {
      const [from, to] = key.split("::");
      if (!from || !to) continue;
      best = { from, to, count };
    }
  }

  return best ? { from: best.from, to: best.to } : null;
}

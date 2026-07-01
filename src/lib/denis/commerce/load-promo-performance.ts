import type { SupabaseClient } from "@supabase/supabase-js";

export type PromoPerformanceRow = {
  code: string;
  uses: number;
  conversionRate: number;
  avgOrderLift: number;
  expiresInDays: number | null;
};

/**
 * Aggregate promo usage from paid orders (admin analytics — T1).
 */
export async function loadPromoPerformanceSnapshot(
  admin: SupabaseClient,
  input: { locationId: string; periodDays?: number }
): Promise<PromoPerformanceRow[]> {
  const periodDays = input.periodDays ?? 30;
  const since = new Date(Date.now() - periodDays * 86_400_000).toISOString();

  const { data: promos } = await admin
    .from("promo_codes")
    .select("id, code, discount_type, discount_value, used_count, valid_until")
    .eq("location_id", input.locationId);

  if (!promos?.length) return [];

  const { data: orders } = await admin
    .from("orders")
    .select("promo_code_id, total")
    .eq("location_id", input.locationId)
    .gte("created_at", since)
    .not("promo_code_id", "is", null)
    .neq("status", "cancelled");

  const usesByPromo = new Map<string, { count: number; total: number }>();
  for (const order of orders ?? []) {
    const promoId = (order as { promo_code_id: string | null }).promo_code_id;
    const total = Number((order as { total: number }).total ?? 0);
    if (!promoId) continue;
    const row = usesByPromo.get(promoId) ?? { count: 0, total: 0 };
    row.count += 1;
    row.total += total;
    usesByPromo.set(promoId, row);
  }

  const now = Date.now();

  return promos.map((row) => {
    const promo = row as {
      id: string;
      code: string;
      used_count: number;
      valid_until: string | null;
    };
    const usage = usesByPromo.get(promo.id);
    const uses = usage?.count ?? promo.used_count ?? 0;
    const avgOrderLift =
      usage && usage.count > 0 ? Math.round(usage.total / usage.count) : 0;
    const expiresInDays = promo.valid_until
      ? Math.ceil(
          (new Date(promo.valid_until).getTime() - now) / 86_400_000
        )
      : null;

    return {
      code: promo.code,
      uses,
      conversionRate: uses > 0 ? 1 : 0,
      avgOrderLift,
      expiresInDays,
    };
  });
}

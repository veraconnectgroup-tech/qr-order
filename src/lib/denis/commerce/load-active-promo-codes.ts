import type { SupabaseClient } from "@supabase/supabase-js";
import type { PromoCode } from "@/types";
import { isPromoCurrentlyValid } from "@/lib/denis/commerce/promo-intelligence";

export async function loadActivePromoCodesForLocation(
  admin: SupabaseClient,
  locationId: string,
  options?: { now?: number; cartTotal?: number }
): Promise<PromoCode[]> {
  const now = options?.now ?? Date.now();
  const cartTotal = options?.cartTotal ?? 0;

  const { data, error } = await admin
    .from("promo_codes")
    .select("*")
    .eq("location_id", locationId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return (data as PromoCode[]).filter((promo) =>
    isPromoCurrentlyValid(promo, now, cartTotal)
  );
}

import type { ProductRecommendation } from "@/components/guest/product-recommendation-card";
import type { MenuCategory } from "@/components/guest/menu-grid";
import type { AiSheetSelections } from "@/lib/ai/guest-sheet-preferences";

const DEMO_REASONS: Record<string, string> = {
  leicht: "Leicht und erfrischend — passt gut zu deinem Wunsch.",
  herzhaft: "Deftig und sättigend — genau richtig für heute Abend.",
  schnell: "Schnell zubereitet — ideal wenn es zügig gehen soll.",
  ueberraschung: "Unser Tipp — beliebt an der Bar und perfekt zum Probieren.",
};

/** Static AI picks for the public demo menu (no OpenAI / Supabase). */
export function getDemoAiRecommendations(
  categories: MenuCategory[],
  selections: AiSheetSelections
): ProductRecommendation[] {
  const products = categories.flatMap((c) => c.products).filter((p) => p.is_available);
  const mood = selections.mood ?? "ueberraschung";
  const reason = DEMO_REASONS[mood] ?? DEMO_REASONS.ueberraschung;

  const picks =
    mood === "leicht"
      ? products.filter((p) => p.prep_time_minutes != null && p.prep_time_minutes <= 10)
      : mood === "schnell"
        ? products.filter((p) => (p.prep_time_minutes ?? 99) <= 8)
        : products;

  const pool = picks.length >= 2 ? picks : products;

  return pool.slice(0, 3).map((product) => ({
    productId: product.id,
    name: product.name,
    price: Number(product.price),
    imageUrl: product.image_url,
    reason,
  }));
}

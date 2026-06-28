import type { Category } from "@/types";

export type CategoryRow = Category & { productCount: number };

export const PRODUCT_GRADIENTS = [
  "from-orange-900/40 to-amber-900/20",
  "from-rose-900/40 to-pink-900/20",
  "from-violet-900/40 to-purple-900/20",
  "from-blue-900/40 to-cyan-900/20",
  "from-emerald-900/40 to-teal-900/20",
] as const;

export function productGradient(name: string) {
  return PRODUCT_GRADIENTS[name.charCodeAt(0) % PRODUCT_GRADIENTS.length];
}

export type MenuEditorProductFormValues = {
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  price: number;
  prep_time_minutes: number | null;
  is_available: boolean;
  image_url: string | null;
  allergens: string[] | null;
  requires_serve_size: boolean;
  serve_size_presets: string[] | null;
  allow_custom_serve_size: boolean;
  tax_rate: number | null;
  ai_description: string;
};

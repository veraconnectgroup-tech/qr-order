import type { MenuSection } from "@/lib/menu-section";
import type { AiProductSummary } from "@/lib/ai/types";

export type AiCatalogModifier = {
  id: string;
  name: string;
  price: number;
};

export type AiCatalogModifierGroup = {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  modifiers: AiCatalogModifier[];
};

export type AiCatalogProduct = AiProductSummary & {
  menuSection: MenuSection;
  taxRate: number | null;
  allergens: string[];
  tags?: string[];
  drinkFamily?: string | null;
  foodTags?: string[];
  prepStation?: string | null;
  modifierGroups: AiCatalogModifierGroup[];
  requiresServeSize: boolean;
  serveSizePresets: string[];
  allowCustomServeSize: boolean;
};

export type AiCatalog = {
  menuText: string;
  productMap: Record<string, AiProductSummary>;
  catalog: Record<string, AiCatalogProduct>;
  currency: string;
  cachedAt: string;
};

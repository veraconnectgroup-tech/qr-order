import type { AiCatalog, AiCatalogProduct } from "@/lib/ai/catalog/catalog-types";
import type { AiProductSummary } from "@/lib/ai/types";
import { formatPrice } from "@/lib/format";
import { inferMenuSection } from "@/lib/menu-section";
import { formatServeSize } from "@/lib/serve-size";

type RawModifier = {
  id: string;
  name: string;
  name_en: string | null;
  price: number;
  is_available: boolean;
  sort_order: number;
};

type RawModifierGroup = {
  id: string;
  name: string;
  name_en: string | null;
  min_select: number;
  max_select: number;
  is_required: boolean;
  sort_order: number;
  modifiers: RawModifier[] | null;
};

type RawProduct = {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
  ai_description: string | null;
  allergens: string[] | null;
  requires_serve_size?: boolean;
  serve_size_presets?: string[] | null;
  allow_custom_serve_size?: boolean;
  tax_rate?: number | null;
  deleted_at?: string | null;
  modifier_groups?: RawModifierGroup[] | null;
};

type RawCategory = {
  id: string;
  name: string;
  name_en: string | null;
  menu_section?: string | null;
  sort_order: number;
  products: RawProduct[] | null;
};

function pickName(row: { name: string; name_en: string | null }, useEnglish: boolean) {
  if (useEnglish && row.name_en?.trim()) return row.name_en.trim();
  return row.name;
}

function pickDescription(product: RawProduct, useEnglish: boolean) {
  const ai = product.ai_description?.trim();
  if (ai) return ai;
  if (useEnglish && product.description_en?.trim()) {
    return product.description_en.trim();
  }
  return product.description?.trim() ?? "";
}

function formatModifierPrice(price: number, currency: string) {
  if (price <= 0) return "";
  return ` +${formatPrice(Number(price), currency)}`;
}

export function buildAiCatalog(
  categories: RawCategory[],
  currency: string,
  useEnglish: boolean
): AiCatalog {
  const productMap: Record<string, AiProductSummary> = {};
  const catalog: Record<string, AiCatalogProduct> = {};
  const lines: string[] = [];

  const sortedCategories = [...categories].sort(
    (a, b) => a.sort_order - b.sort_order
  );

  for (const category of sortedCategories) {
    const categoryName = pickName(category, useEnglish);
    const menuSection = inferMenuSection(category);

    const products = (category.products ?? [])
      .filter((p) => p.is_available && !p.deleted_at)
      .sort((a, b) => a.sort_order - b.sort_order);

    if (!products.length) continue;

    lines.push(`## ${categoryName}`);

    for (const product of products) {
      const name = pickName(product, useEnglish);
      const description = pickDescription(product, useEnglish);
      const priceLabel = formatPrice(Number(product.price), currency);
      const allergenPart = product.allergens?.length
        ? ` | allergens: ${product.allergens.join(", ")}`
        : "";

      const modifierGroups = (product.modifier_groups ?? [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((group) => ({
          id: group.id,
          name: pickName(group, useEnglish),
          minSelect: group.min_select,
          maxSelect: group.max_select,
          isRequired: group.is_required,
          modifiers: (group.modifiers ?? [])
            .filter((m) => m.is_available)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((m) => ({
              id: m.id,
              name: pickName(m, useEnglish),
              price: Number(m.price),
            })),
        }))
        .filter((g) => g.modifiers.length > 0);

      const serveSizePresets = (product.serve_size_presets ?? []).map((s) =>
        formatServeSize(s)
      );
      const requiresServeSize =
        Boolean(product.requires_serve_size) && serveSizePresets.length > 0;

      lines.push(
        `[${product.id}] ${name} — ${priceLabel} | section: ${menuSection}${description ? ` — ${description}` : ""}${allergenPart}`
      );

      if (requiresServeSize) {
        lines.push(
          `  serve_sizes (required): ${serveSizePresets.join(", ")}`
        );
      }

      for (const group of modifierGroups) {
        const reqLabel = group.isRequired ? "required" : "optional";
        lines.push(
          `  modifiers — ${group.name} (${reqLabel}, min ${group.minSelect}, max ${group.maxSelect}):`
        );
        for (const mod of group.modifiers) {
          lines.push(
            `    [${mod.id}] ${mod.name}${formatModifierPrice(mod.price, currency)}`
          );
        }
      }

      const summary: AiProductSummary = {
        id: product.id,
        name,
        price: Number(product.price),
        imageUrl: product.image_url,
      };

      productMap[product.id] = summary;
      catalog[product.id] = {
        ...summary,
        menuSection,
        taxRate: product.tax_rate != null ? Number(product.tax_rate) : null,
        allergens: product.allergens ?? [],
        modifierGroups,
        requiresServeSize,
        serveSizePresets,
        allowCustomServeSize: product.allow_custom_serve_size ?? true,
      };
    }

    lines.push("");
  }

  return {
    menuText: lines.join("\n").trim(),
    productMap,
    catalog,
    currency,
    cachedAt: new Date().toISOString(),
  };
}

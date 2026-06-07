import type { AiCatalogProduct } from "@/lib/ai/catalog/catalog-types";
import { formatServeSize } from "@/lib/serve-size";

/** Presets like 0.3, 0.5, 0.33 — drink volumes, not food portions. */
export function isVolumeServeSize(value: string): boolean {
  const normalized = value.trim().replace(/,/g, ".").replace(/l$/i, "").trim();
  return /^\d+(\.\d+)?$/.test(normalized);
}

export function formatServeSizeOption(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (isVolumeServeSize(trimmed) || /^\d/.test(trimmed)) {
    return formatServeSize(trimmed);
  }
  return trimmed;
}

export function productExpectsVolumeServeSize(product: AiCatalogProduct): boolean {
  if (product.menuSection === "drinks") return true;
  if (!product.serveSizePresets.length) return false;
  return product.serveSizePresets.every((preset) =>
    isVolumeServeSize(formatServeSizeOption(preset))
  );
}

/** Food with drink-style presets in DB — ignore broken serve_size config. */
export function shouldAskForServeSize(product: AiCatalogProduct): boolean {
  if (!product.requiresServeSize || !product.serveSizePresets.length) {
    return false;
  }
  if (product.menuSection === "food" || product.menuSection === "desserts") {
    return !product.serveSizePresets.every((preset) =>
      isVolumeServeSize(formatServeSizeOption(preset))
    );
  }
  return true;
}

export function sanitizeServeSizeForProduct(
  product: AiCatalogProduct,
  serveSize: string | null | undefined
): string | null {
  if (!serveSize?.trim()) return null;
  const formatted = formatServeSizeOption(serveSize.trim());
  if (
    (product.menuSection === "food" || product.menuSection === "desserts") &&
    isVolumeServeSize(formatted)
  ) {
    return null;
  }
  return formatted;
}

/** Union sorted drink volume presets across products (e.g. 0.3L, 0.5L). */
export function unionVolumePresets(products: AiCatalogProduct[]): string[] {
  const sizes = new Set<string>();
  for (const product of products) {
    for (const preset of product.serveSizePresets) {
      const formatted = formatServeSizeOption(preset);
      if (isVolumeServeSize(formatted)) sizes.add(formatted);
    }
  }
  return [...sizes].sort(
    (a, b) =>
      parseFloat(a.replace(/l$/i, "")) - parseFloat(b.replace(/l$/i, ""))
  );
}

/** Infer serve size from message against a preset list (category-level orders). */
export function inferServeSizeFromPresets(
  message: string,
  presets: string[]
): string | null {
  if (!presets.length) return null;
  return inferServeSizeFromMessage(message, {
    serveSizePresets: presets,
  } as AiCatalogProduct);
}

/** True when message uses size words (veliko, malo, 0.5L, …). */
export function messageImpliesServeSize(message: string): boolean {
  const normalized = message.toLowerCase();
  if (/\b(\d+[,.]?\d*)\s*l\b/.test(normalized)) return true;
  return /\b(velik[oa]?|mal[oa]?|small|large|gro[sß]|gross|big|srednj\w*|medium|mittel|regular|grande|petit|mini|klein)\b/i.test(
    normalized
  );
}

/** Map size words in the same utterance — veliko → largest preset, malo → smallest. */
export function inferServeSizeFromMessage(
  message: string,
  product: AiCatalogProduct
): string | null {
  if (!product.serveSizePresets.length) return null;

  const normalized = message.toLowerCase();
  const presets = product.serveSizePresets.map((p) => formatServeSizeOption(p));

  const explicit = normalized.match(/\b(\d+[,.]?\d*)\s*l\b/);
  if (explicit) {
    const target = explicit[1].replace(",", ".").replace(/l$/i, "").trim();
    const matched = presets.find(
      (p) => p.replace(/l$/i, "").trim() === target
    );
    if (matched) return matched;
  }

  if (/\b(malu|mala|mal[oa]?|small|klein|mini|petit)\b/i.test(normalized)) {
    return presets[0] ?? null;
  }

  if (/\b(velik[oa]?|large|gro[sß]|gross|big|grande)\b/i.test(normalized)) {
    return presets[presets.length - 1] ?? null;
  }

  if (
    /\b(srednj\w*|medium|mittel|regular)\b/i.test(normalized) &&
    presets.length >= 2
  ) {
    return presets[Math.floor(presets.length / 2)] ?? presets[1] ?? null;
  }

  return null;
}

/** Gap-resolved typed drink without size — default to 0.5L or largest preset. */
export function resolveImplicitServeSizeForProduct(
  product: AiCatalogProduct
): string | null {
  if (!shouldAskForServeSize(product)) return null;
  const presets = product.serveSizePresets.map((preset) =>
    formatServeSizeOption(preset)
  );
  if (!presets.length) return null;
  const halfLiter = presets.find((preset) =>
    /^0[,.]5\s*l$/i.test(preset.trim())
  );
  return halfLiter ?? presets[presets.length - 1] ?? null;
}

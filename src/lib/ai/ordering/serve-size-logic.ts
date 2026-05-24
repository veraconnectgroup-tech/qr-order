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

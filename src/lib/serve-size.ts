export const DEFAULT_SERVE_SIZE_PRESETS = ["0.2", "0.3", "0.5"];

export function formatServeSize(value: string) {
  const trimmed = value.trim().replace(/,/g, ".");
  if (!trimmed) return "";
  return trimmed.toLowerCase().endsWith("l") ? trimmed : `${trimmed}L`;
}

export function parseServeSizePresets(raw: string | null | undefined) {
  if (!raw?.trim()) return [...DEFAULT_SERVE_SIZE_PRESETS];
  return raw
    .split(",")
    .map((part) => part.trim().replace(/,/g, "."))
    .filter(Boolean);
}

export function isValidServeSize(value: string) {
  const normalized = value.trim().replace(/,/g, ".").replace(/l$/i, "");
  if (!normalized) return false;
  const num = Number(normalized);
  return Number.isFinite(num) && num >= 0.01 && num <= 5;
}

export function productHasServeSize(product: {
  requires_serve_size?: boolean;
  serve_size_presets?: string[] | null;
}) {
  return (
    Boolean(product.requires_serve_size) &&
    (product.serve_size_presets?.length ?? 0) > 0
  );
}

export function serveSizeOrderNote(serveSize: string | null | undefined) {
  if (!serveSize?.trim()) return null;
  return `Serve: ${formatServeSize(serveSize)}`;
}

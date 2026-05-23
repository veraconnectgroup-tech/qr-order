export function localizedName(
  item: { name: string; name_en?: string | null },
  isEnglish: boolean
) {
  if (isEnglish && item.name_en?.trim()) return item.name_en.trim();
  return item.name;
}

export function localizedDescription(
  item: { description?: string | null; description_en?: string | null },
  isEnglish: boolean
) {
  if (isEnglish && item.description_en?.trim()) {
    return item.description_en.trim();
  }
  return item.description ?? null;
}

export function productMatchesSearch(
  product: {
    name: string;
    name_en?: string | null;
    description?: string | null;
    description_en?: string | null;
  },
  query: string
) {
  const q = query.toLowerCase();
  return (
    product.name.toLowerCase().includes(q) ||
    product.name_en?.toLowerCase().includes(q) ||
    product.description?.toLowerCase().includes(q) ||
    product.description_en?.toLowerCase().includes(q)
  );
}

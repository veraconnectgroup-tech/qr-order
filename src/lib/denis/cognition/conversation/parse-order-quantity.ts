const WORD_QUANTITY: Record<string, number> = {
  ein: 1,
  eine: 1,
  einen: 1,
  eins: 1,
  one: 1,
  a: 1,
  an: 1,
  jedan: 1,
  jedna: 1,
  jedno: 1,
  par: 2,
  pair: 2,
  paar: 2,
  dva: 2,
  zwei: 2,
  two: 2,
  tri: 3,
  drei: 3,
  three: 3,
  cetiri: 4,
  četiri: 4,
  four: 4,
  pet: 5,
  fünf: 5,
  funf: 5,
  five: 5,
};

export function parseOrderQuantityToken(token: string): number | null {
  const lower = token.trim().toLowerCase();
  if (!lower) return null;
  if (WORD_QUANTITY[lower] != null) return WORD_QUANTITY[lower];
  const numericMatch = lower.match(/^(\d{1,2})[x×]?$/);
  if (numericMatch?.[1]) {
    const n = Number.parseInt(numericMatch[1], 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const n = Number.parseInt(lower, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Leading quantity on an order segment — "dva sladoleda", "2x burger", "par piva". */
export function parseLeadingOrderQuantity(
  segment: string
): { quantity: number; remainder: string } | null {
  const trimmed = segment.trim();
  if (!trimmed) return null;

  const numericPrefix = trimmed.match(/^(\d{1,2})\s*[x×]?\s+(.+)$/i);
  if (numericPrefix?.[1] && numericPrefix[2]) {
    const quantity = Number.parseInt(numericPrefix[1], 10);
    if (Number.isFinite(quantity) && quantity > 0) {
      return { quantity, remainder: numericPrefix[2].trim() };
    }
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    const qty = parseOrderQuantityToken(parts[0]!);
    if (qty != null) {
      const remainder = parts.slice(1).join(" ").trim();
      if (remainder.length >= 2) {
        return { quantity: qty, remainder };
      }
    }
  }

  return null;
}

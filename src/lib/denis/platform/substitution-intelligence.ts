export const MIN_SUBSTITUTION_PRODUCT_ORDERS = 20;
export const SUBSTITUTION_AUTO_GAP_RATE = 0.5;

export type SubstitutionModifierRow = {
  productId: string;
  productName: string;
  notes: string | null;
  modifierNames: string[];
};

export type SubstitutionPattern = {
  productId: string;
  productName: string;
  original: string;
  replacement: string;
  count: number;
  percentage: number;
};

export type ParsedSubstitution = {
  requested: string;
  insteadOf: string;
};

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

/** Parse "pomfrit umesto salate" from order notes (K3 — no cognition import). */
export function parseSubstitutionFromText(text: string): ParsedSubstitution | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const umestoMatch = trimmed.match(/\b(.+?)\s+umesto\s+(.+?)(?:\s*[,.]|$)/i);
  if (umestoMatch?.[1] && umestoMatch[2]) {
    const requested = umestoMatch[1].trim();
    const insteadOf = umestoMatch[2].trim();
    if (requested.length >= 2 && insteadOf.length >= 2) {
      return { requested, insteadOf };
    }
  }

  const insteadMatch = trimmed.match(/\b(.+?)\s+(?:instead of|statt)\s+(.+?)(?:\s*[,.]|$)/i);
  if (insteadMatch?.[1] && insteadMatch[2]) {
    const requested = insteadMatch[1].trim();
    const insteadOf = insteadMatch[2].trim();
    if (requested.length >= 2 && insteadOf.length >= 2) {
      return { requested, insteadOf };
    }
  }

  return null;
}

function patternKey(original: string, replacement: string): string {
  return `${normalizeToken(original)}->${normalizeToken(replacement)}`;
}

/** Learn venue substitution patterns from delivered order lines (K3). */
export function learnSubstitutionPatterns(
  rows: SubstitutionModifierRow[]
): SubstitutionPattern[] {
  const byProduct = new Map<
    string,
    { productName: string; rows: SubstitutionModifierRow[] }
  >();

  for (const row of rows) {
    const productId = row.productId.trim();
    if (!productId) continue;
    const bucket = byProduct.get(productId);
    if (bucket) {
      bucket.rows.push(row);
    } else {
      byProduct.set(productId, {
        productName: row.productName,
        rows: [row],
      });
    }
  }

  const patterns: SubstitutionPattern[] = [];

  for (const [productId, bucket] of byProduct) {
    const totalOrders = bucket.rows.length;
    if (totalOrders < MIN_SUBSTITUTION_PRODUCT_ORDERS) continue;

    const counts = new Map<
      string,
      { original: string; replacement: string; count: number }
    >();

    for (const row of bucket.rows) {
      const parsed = parseSubstitutionFromText(row.notes ?? "");
      if (!parsed) continue;

      const key = patternKey(parsed.insteadOf, parsed.requested);
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, {
          original: parsed.insteadOf,
          replacement: parsed.requested,
          count: 1,
        });
      }
    }

    for (const entry of counts.values()) {
      patterns.push({
        productId,
        productName: bucket.productName,
        original: entry.original,
        replacement: entry.replacement,
        count: entry.count,
        percentage: entry.count / totalOrders,
      });
    }
  }

  return patterns.sort(
    (a, b) =>
      b.percentage - a.percentage ||
      b.count - a.count ||
      a.productName.localeCompare(b.productName)
  );
}

function textIncludesToken(text: string, token: string): boolean {
  const normalized = normalizeToken(text);
  const needle = normalizeToken(token);
  if (!needle) return false;
  return normalized.includes(needle);
}

export function guestSpecifiedSubstitution(input: {
  guestMessages: Array<string | null | undefined>;
  cartNotes: string[];
  original: string;
  replacement: string;
}): boolean {
  for (const raw of input.guestMessages) {
    const text = raw?.trim();
    if (!text) continue;
    const parsed = parseSubstitutionFromText(text);
    if (
      parsed &&
      textIncludesToken(parsed.insteadOf, input.original) &&
      textIncludesToken(parsed.requested, input.replacement)
    ) {
      return true;
    }
    if (
      textIncludesToken(text, input.original) &&
      textIncludesToken(text, input.replacement)
    ) {
      return true;
    }
  }

  for (const note of input.cartNotes) {
    if (!note.trim()) continue;
    if (
      textIncludesToken(note, input.original) &&
      textIncludesToken(note, input.replacement)
    ) {
      return true;
    }
  }

  return false;
}

export function findSubstitutionPatternForProduct(input: {
  productId: string;
  productName: string;
  patterns: SubstitutionPattern[];
  minRate?: number;
}): SubstitutionPattern | null {
  const minRate = input.minRate ?? SUBSTITUTION_AUTO_GAP_RATE;
  const matches = input.patterns.filter(
    (pattern) =>
      pattern.productId === input.productId &&
      pattern.percentage >= minRate &&
      pattern.count > 0
  );
  if (matches.length > 0) return matches[0]!;

  const byName = input.patterns.filter(
    (pattern) =>
      normalizeToken(pattern.productName) === normalizeToken(input.productName) &&
      pattern.percentage >= minRate
  );
  return byName[0] ?? null;
}

export function buildSubstitutionSidePrompt(
  pattern: SubstitutionPattern,
  language: string
): string {
  const lang = language.slice(0, 2);
  if (lang === "de") {
    return `Mit ${pattern.original} oder ${pattern.replacement}?`;
  }
  if (lang === "en") {
    return `With ${pattern.original} or ${pattern.replacement}?`;
  }
  return `Sa ${pattern.original} ili ${pattern.replacement}?`;
}

export function buildGuestModifierPrefPrompt(
  preferences: string[],
  language: string
): string | null {
  const prefs = preferences.map((pref) => pref.trim()).filter(Boolean).slice(0, 2);
  if (!prefs.length) return null;

  const lang = language.slice(0, 2);
  if (lang === "de") {
    return `Sie wünschen oft ${prefs.join(", ")} — gilt das auch hier?`;
  }
  if (lang === "en") {
    return `You often ask for ${prefs.join(", ")} — same this time?`;
  }
  return `Obično tražite ${prefs.join(", ")} — da li i ovaj put?`;
}

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/** Situation-pack block for learned substitutions (K3). */
export function formatSubstitutionHintBlock(input: {
  cartLines: Array<{ productId: string; productName: string; notes?: string | null }>;
  patterns: SubstitutionPattern[];
  guestMessages: Array<string | null | undefined>;
  guestModifierPreferences?: string[];
}): string {
  const lines: string[] = [];

  for (const line of input.cartLines) {
    const pattern = findSubstitutionPatternForProduct({
      productId: line.productId,
      productName: line.productName,
      patterns: input.patterns,
    });
    if (!pattern) continue;

    if (
      guestSpecifiedSubstitution({
        guestMessages: input.guestMessages,
        cartNotes: [line.notes ?? ""],
        original: pattern.original,
        replacement: pattern.replacement,
      })
    ) {
      continue;
    }

    lines.push(
      `- Uz ${pattern.productName}, ${pct(pattern.percentage)} gostiju mijenja ${pattern.original} za ${pattern.replacement}. Ponudi: "${buildSubstitutionSidePrompt(pattern, "sr")}"`
    );
  }

  const prefs = (input.guestModifierPreferences ?? [])
    .map((pref) => pref.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (prefs.length > 0) {
    const prefPrompt = buildGuestModifierPrefPrompt(prefs, "sr");
    if (prefPrompt) {
      lines.push(
        `- Returning guest modifier prefs: ${prefs.join(", ")}. Confirm when relevant — "${prefPrompt}"`
      );
    }
  }

  if (!lines.length) return "";
  return ["SUBSTITUTION HINT:", ...lines].join("\n");
}

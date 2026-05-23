export const EU_ALLERGENS = [
  { id: "gluten", label: "Gluten", emoji: "🌾" },
  { id: "crustaceans", label: "Krebstiere", emoji: "🦀" },
  { id: "eggs", label: "Eier", emoji: "🥚" },
  { id: "fish", label: "Fisch", emoji: "🐟" },
  { id: "peanuts", label: "Erdnüsse", emoji: "🥜" },
  { id: "soybeans", label: "Soja", emoji: "🫘" },
  { id: "milk", label: "Milch/Laktose", emoji: "🥛" },
  { id: "nuts", label: "Schalenfrüchte", emoji: "🌰" },
  { id: "celery", label: "Sellerie", emoji: "🥬" },
  { id: "mustard", label: "Senf", emoji: "🟡" },
  { id: "sesame", label: "Sesam", emoji: "⭕" },
  { id: "sulphites", label: "Sulfite", emoji: "🍷" },
  { id: "lupin", label: "Lupinen", emoji: "🌻" },
  { id: "molluscs", label: "Weichtiere", emoji: "🐚" },
] as const;

export type AllergenId = (typeof EU_ALLERGENS)[number]["id"];

export const EU_ALLERGEN_IDS = EU_ALLERGENS.map((a) => a.id) as AllergenId[];

const ALLERGEN_BY_ID = new Map(EU_ALLERGENS.map((a) => [a.id, a]));

const ALLERGEN_ALIASES: Record<string, AllergenId> = {
  gluten: "gluten",
  wheat: "gluten",
  crustaceans: "crustaceans",
  shellfish: "crustaceans",
  eggs: "eggs",
  egg: "eggs",
  fish: "fish",
  peanuts: "peanuts",
  peanut: "peanuts",
  soybeans: "soybeans",
  soy: "soybeans",
  soya: "soybeans",
  milk: "milk",
  dairy: "milk",
  lactose: "milk",
  nuts: "nuts",
  tree_nuts: "nuts",
  "tree nuts": "nuts",
  celery: "celery",
  mustard: "mustard",
  sesame: "sesame",
  sulphites: "sulphites",
  sulfites: "sulphites",
  sulfite: "sulphites",
  lupin: "lupin",
  lupine: "lupin",
  molluscs: "molluscs",
  mollusks: "molluscs",
};

function normalizeToken(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "_");
}

export function normalizeAllergenId(raw: string): AllergenId | null {
  const token = normalizeToken(raw);
  if ((EU_ALLERGEN_IDS as string[]).includes(token)) {
    return token as AllergenId;
  }
  return ALLERGEN_ALIASES[token] ?? ALLERGEN_ALIASES[raw.trim().toLowerCase()] ?? null;
}

export function getAllergenMeta(id: AllergenId) {
  return ALLERGEN_BY_ID.get(id)!;
}

export type ResolvedAllergen = {
  id: AllergenId | null;
  raw: string;
  emoji: string | null;
  label: string;
};

export function resolveProductAllergens(
  allergens: string[] | null | undefined
): ResolvedAllergen[] {
  if (!allergens?.length) return [];

  const seen = new Set<string>();
  const resolved: ResolvedAllergen[] = [];

  for (const raw of allergens) {
    const id = normalizeAllergenId(raw);
    const key = id ?? raw.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    if (id) {
      const meta = getAllergenMeta(id);
      resolved.push({
        id,
        raw,
        emoji: meta.emoji,
        label: meta.label,
      });
    } else {
      resolved.push({
        id: null,
        raw,
        emoji: null,
        label: raw,
      });
    }
  }

  return resolved;
}

export function productAllergenIds(
  allergens: string[] | null | undefined
): AllergenId[] {
  const ids = new Set<AllergenId>();
  for (const raw of allergens ?? []) {
    const id = normalizeAllergenId(raw);
    if (id) ids.add(id);
  }
  return [...ids];
}

export function isProductHiddenByAllergenFilter(
  allergens: string[] | null | undefined,
  excluded: ReadonlySet<AllergenId>
): boolean {
  if (excluded.size === 0) return false;
  return productAllergenIds(allergens).some((id) => excluded.has(id));
}

export function parseStoredAllergenExclusions(raw: string | null): Set<AllergenId> {
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    const ids = parsed
      .map((v) => (typeof v === "string" ? normalizeAllergenId(v) : null))
      .filter((v): v is AllergenId => v != null);
    return new Set(ids);
  } catch {
    return new Set();
  }
}

export function serializeAllergenExclusions(excluded: ReadonlySet<AllergenId>): string {
  return JSON.stringify([...excluded]);
}

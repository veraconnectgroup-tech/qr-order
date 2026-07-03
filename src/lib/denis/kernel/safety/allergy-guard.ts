import {
  getAllergenMeta,
  normalizeAllergenId,
  productAllergenIds,
  type AllergenId,
} from "@/lib/allergens";
import type { DenisCartLine } from "@/lib/denis/kernel/cart-projection";

export type AllergyGuardProduct = {
  id: string;
  name: string;
  allergens: string[];
};

export type AllergyGuardConflict = {
  productId: string;
  productName: string;
  allergen: string;
  severity: "block" | "warn";
};

export type AllergyGuardResult = {
  safe: boolean;
  conflicts: AllergyGuardConflict[];
  message: string | null;
};

const EXCLUSION_PREFIX =
  /\b(?:bez|without|no|ohne|sin|sans|kein(?:e|er|es)?)\s+([\p{L}\p{N}_-]+)/giu;

const COMPOUND_FREE_PATTERN =
  /\b(gluten|laktose|lactose|dairy|milch|milk|nuss|nut|soy|soja|vegan|kikiriki|peanut|orah|oraha)[\s-]*(?:free|frei)\b/giu;

const STANDALONE_FREE_PATTERN =
  /\b(glutenfrei|laktosefrei|vegan|vegetarisch)\b/giu;

const ALLERGY_DECLARE_PATTERN =
  /\b(alergij\w*|allerg\w*|intoleran\w*)\s+(?:na|to|on|gegen|against)?\s*([\p{L}\p{N}_-]+)/giu;

const ALLERGY_ACK_PATTERN =
  /\b(znam|siguran|sigurna|sigurni|hoću\s+ipak|hocu\s+ipak|ipak\s+hoću|ipak\s+hocu|anyway|trotzdem|yes\s+i\s+know|i\s+know|nema\s+problema|u\s+redu|ok\s+je|da\s+je\s+ok)\b/i;

function normalizeQueryText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function allergenFromToken(raw: string): AllergenId | null {
  const token = raw.trim().toLowerCase();
  if (!token) return null;

  const direct = normalizeAllergenId(token);
  if (direct) return direct;

  const stem = token.replace(/(a|e|u|i|o)$/u, "");
  if (stem.length >= 4) {
    const stemMatch = normalizeAllergenId(stem);
    if (stemMatch) return stemMatch;
  }

  if (token.startsWith("gluten")) return "gluten";
  if (token.startsWith("laktose") || token.startsWith("lactose")) return "milk";
  if (token.startsWith("milch") || token.startsWith("mleka")) return "milk";
  if (token.startsWith("nuss") || token.startsWith("orah")) return "nuts";
  if (
    token.startsWith("lesnik") ||
    token.startsWith("lešnik") ||
    token.startsWith("lesnike") ||
    token.startsWith("lešnike") ||
    token.startsWith("hazelnut") ||
    token.startsWith("orasast")
  ) {
    return "nuts";
  }
  if (token.startsWith("kikiriki") || token.startsWith("peanut")) return "peanuts";

  return null;
}

/** Guest turn mentions allergens — show allergy thinking / filter menu, not on plain orders. */
export function isGuestAllergyRelatedMessage(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return parseAllergenExclusionsFromText(trimmed).length > 0;
}

/** Parse allergen exclusions from guest text (chat + menu query). */
export function parseAllergenExclusionsFromText(text: string): AllergenId[] {
  const excluded = new Set<AllergenId>();
  const normalized = normalizeQueryText(text);

  for (const match of normalized.matchAll(EXCLUSION_PREFIX)) {
    const allergen = allergenFromToken(match[1] ?? "");
    if (allergen) excluded.add(allergen);
  }

  for (const match of normalized.matchAll(COMPOUND_FREE_PATTERN)) {
    const allergen = allergenFromToken(match[1] ?? "");
    if (allergen) excluded.add(allergen);
  }

  for (const match of normalized.matchAll(STANDALONE_FREE_PATTERN)) {
    const allergen = allergenFromToken(match[0] ?? "");
    if (allergen) excluded.add(allergen);
  }

  for (const match of text.matchAll(ALLERGY_DECLARE_PATTERN)) {
    const allergen = allergenFromToken(match[2] ?? match[1] ?? "");
    if (allergen) excluded.add(allergen);
  }

  return [...excluded];
}

export function resolveKnownAllergenIds(
  labels: string[] | null | undefined
): AllergenId[] {
  const ids = new Set<AllergenId>();
  for (const label of labels ?? []) {
    const id = normalizeAllergenId(label);
    if (id) ids.add(id);
  }
  return [...ids];
}

export function mergeAllergieLabelSets(
  existing: string[],
  detected: AllergenId[]
): string[] {
  const merged = new Set(existing.map((label) => label.trim()).filter(Boolean));
  for (const id of detected) {
    merged.add(id);
  }
  return [...merged].slice(0, 20);
}

export function isAllergyAcknowledged(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return false;
  return ALLERGY_ACK_PATTERN.test(trimmed);
}

function allergenDisplayLabel(allergenId: AllergenId): string {
  return getAllergenMeta(allergenId).label;
}

function buildAllergyWarningMessage(
  conflict: AllergyGuardConflict,
  language: string
): string {
  const lang = language.slice(0, 2);
  const allergen = conflict.allergen;
  const product = conflict.productName;

  if (lang === "de") {
    return `${product} enthält ${allergen} — sind Sie sicher?`;
  }
  if (lang === "en") {
    return `${product} contains ${allergen} — are you sure?`;
  }
  return `${product} sadrži ${allergen} — jeste li sigurni?`;
}

/** Check cart against known guest allergens — WARN only, never silent deny (F2). */
export function checkAllergyConflict(input: {
  cartItems: DenisCartLine[];
  knownAllergens: AllergenId[];
  products: Map<string, AllergyGuardProduct> | Record<string, AllergyGuardProduct>;
  language?: string;
}): AllergyGuardResult {
  if (input.knownAllergens.length === 0 || input.cartItems.length === 0) {
    return { safe: true, conflicts: [], message: null };
  }

  const known = new Set(input.knownAllergens);
  const productMap =
    input.products instanceof Map
      ? input.products
      : new Map(Object.entries(input.products));
  const conflicts: AllergyGuardConflict[] = [];

  for (const line of input.cartItems) {
    const product = productMap.get(line.productId);
    if (!product) continue;

    for (const allergenId of productAllergenIds(product.allergens)) {
      if (!known.has(allergenId)) continue;
      conflicts.push({
        productId: line.productId,
        productName: line.productName || product.name,
        allergen: allergenDisplayLabel(allergenId),
        severity: "warn",
      });
    }
  }

  if (conflicts.length === 0) {
    return { safe: true, conflicts: [], message: null };
  }

  const language = input.language ?? "sr";
  const primary = conflicts[0]!;
  return {
    safe: false,
    conflicts,
    message: buildAllergyWarningMessage(primary, language),
  };
}

export function catalogToAllergyGuardProducts(
  catalog: Record<string, { id: string; name: string; allergens: string[] }>
): Map<string, AllergyGuardProduct> {
  const map = new Map<string, AllergyGuardProduct>();
  for (const product of Object.values(catalog)) {
    map.set(product.id, {
      id: product.id,
      name: product.name,
      allergens: product.allergens ?? [],
    });
  }
  return map;
}

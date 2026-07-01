import { z } from "zod";
import {
  inferMenuSection,
  resolveCategoryLabel,
} from "@/lib/menu-import/normalize-category";
import type {
  MenuCategoryHint,
  MenuImportItem,
  ParsedMenuImport,
} from "@/lib/menu-import/types";

const ocrItemSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  price: z.coerce.number().positive(),
  category: z.string().trim().min(1),
  allergens: z.array(z.string().trim().min(1)).optional(),
});

const ocrPayloadSchema = z.object({
  items: z.array(ocrItemSchema).min(1),
});

const PRICE_LINE =
  /^(.+?)\s+(\d{1,3}(?:[.,]\d{2})?)\s*(?:€|eur)?(?:\s*\([^)]+\))?\s*$/i;

function isCategoryHeader(line: string): boolean {
  if (PRICE_LINE.test(line)) return false;
  if (line.length < 2 || line.length > 48) return false;
  if (/^\d+$/.test(line)) return false;
  return !/\d[.,]\d{2}/.test(line);
}

function parseAllergensInline(text: string): string[] | undefined {
  const match = text.match(/\(([^)]+)\)\s*$/);
  if (!match?.[1]) return undefined;
  const parts = match[1]
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts : undefined;
}

function stripAllergensInline(name: string): string {
  return name.replace(/\([^)]+\)\s*$/, "").trim();
}

export function parseMenuFromOcrText(
  text: string,
  categories: MenuCategoryHint[] = []
): ParsedMenuImport {
  const warnings: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const items: MenuImportItem[] = [];
  let currentCategory = "Food";

  for (const line of lines) {
    if (isCategoryHeader(line)) {
      currentCategory = line.replace(/[:—-]\s*$/, "").trim();
      continue;
    }

    const priceMatch = line.match(PRICE_LINE);
    if (!priceMatch) continue;

    const rawName = priceMatch[1]!.trim();
    const price = Number(priceMatch[2]!.replace(",", "."));
    if (!rawName || !Number.isFinite(price) || price <= 0) {
      warnings.push(`Skipped OCR line "${line}".`);
      continue;
    }

    const allergens = parseAllergensInline(line) ?? parseAllergensInline(rawName);
    const name = stripAllergensInline(stripAllergensInline(rawName));
    const category = resolveCategoryLabel(
      currentCategory || inferMenuSection(name),
      categories
    );

    items.push({
      name,
      description: null,
      price: Math.round(price * 100) / 100,
      category,
      allergens,
    });
  }

  if (!items.length) {
    return {
      items: [],
      warnings: ["Could not extract menu items from OCR text."],
      categoriesUsed: [],
    };
  }

  return {
    items,
    warnings,
    categoriesUsed: [...new Set(items.map((item) => item.category.toLowerCase()))],
  };
}

export function parseMenuFromLlmJson(
  raw: string,
  categories: MenuCategoryHint[] = []
): ParsedMenuImport {
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return {
      items: [],
      warnings: ["LLM response was not valid JSON."],
      categoriesUsed: [],
    };
  }

  const parsed = ocrPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      items: [],
      warnings: ["LLM menu payload failed validation."],
      categoriesUsed: [],
    };
  }

  const items: MenuImportItem[] = parsed.data.items.map((item) => ({
    name: item.name,
    description: item.description ?? null,
    price: Math.round(item.price * 100) / 100,
    category: resolveCategoryLabel(item.category, categories),
    allergens: item.allergens,
  }));

  return {
    items,
    warnings: [],
    categoriesUsed: [...new Set(items.map((item) => item.category.toLowerCase()))],
  };
}

export const MENU_OCR_LLM_SYSTEM_PROMPT = `Extract menu items from restaurant menu text or OCR output.
Return JSON: { "items": [{ "name": string, "description": string|null, "price": number, "category": string, "allergens": string[]|omit }] }
Use EUR prices as numbers (12.50 not "12,50€"). Categories should be concise (Food, Drinks, Desserts, etc.).`;

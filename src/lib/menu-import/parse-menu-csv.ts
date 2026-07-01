import {
  inferMenuSection,
  normalizeCategoryKey,
  resolveCategoryLabel,
} from "@/lib/menu-import/normalize-category";
import type {
  MenuCategoryHint,
  MenuImportItem,
  ParsedMenuImport,
} from "@/lib/menu-import/types";

const HEADER_ALIASES: Record<string, keyof MenuImportItem | "allergens"> = {
  name: "name",
  product: "name",
  item: "name",
  title: "name",
  description: "description",
  desc: "description",
  price: "price",
  cost: "price",
  amount: "price",
  category: "category",
  section: "category",
  type: "category",
  allergens: "allergens",
  allergen: "allergens",
  allergy: "allergens",
};

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function parsePrice(raw: string): number | null {
  const normalized = raw
    .trim()
    .replace(/[€$£]/g, "")
    .replace(/\s/g, "")
    .replace(",", ".");
  if (!normalized) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100) / 100;
}

function parseAllergens(raw: string | undefined): string[] | undefined {
  if (!raw?.trim()) return undefined;
  return raw
    .split(/[;|/]/)
    .flatMap((part) => part.split(","))
    .map((part) => part.trim())
    .filter(Boolean);
}

function resolveHeaderIndex(headers: string[]): Map<number, keyof MenuImportItem | "allergens"> {
  const map = new Map<number, keyof MenuImportItem | "allergens">();
  headers.forEach((header, index) => {
    const key = normalizeCategoryKey(header).replace(/[^a-z0-9 ]/g, "");
    const alias = HEADER_ALIASES[key];
    if (alias) map.set(index, alias);
  });
  return map;
}

export function parseMenuCsv(
  csvText: string,
  categories: MenuCategoryHint[] = []
): ParsedMenuImport {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const warnings: string[] = [];
  if (!lines.length) {
    return { items: [], warnings: ["CSV is empty."], categoriesUsed: [] };
  }

  const headerCells = splitCsvLine(lines[0]!);
  const headerMap = resolveHeaderIndex(headerCells);
  const hasHeader = headerMap.size > 0;
  const dataLines = hasHeader ? lines.slice(1) : lines;

  if (!hasHeader) {
    warnings.push("No header row detected — using name, price, category column order.");
  }

  const items: MenuImportItem[] = [];

  for (const line of dataLines) {
    const cells = splitCsvLine(line);
    if (!cells.some(Boolean)) continue;

    let name = "";
    let description: string | null = null;
    let priceRaw = "";
    let categoryRaw = "";
    let allergensRaw = "";

    if (hasHeader) {
      for (const [index, field] of headerMap.entries()) {
        const value = cells[index] ?? "";
        if (field === "name") name = value;
        if (field === "description") description = value || null;
        if (field === "price") priceRaw = value;
        if (field === "category") categoryRaw = value;
        if (field === "allergens") allergensRaw = value;
      }
    } else {
      name = cells[0] ?? "";
      priceRaw = cells[1] ?? "";
      categoryRaw = cells[2] ?? "";
      allergensRaw = cells[3] ?? "";
      description = cells[4] ?? null;
    }

    const price = parsePrice(priceRaw);
    if (!name.trim() || price == null) {
      warnings.push(`Skipped row "${line}" — missing name or price.`);
      continue;
    }

    const category =
      categoryRaw.trim() ||
      resolveCategoryLabel(inferMenuSection(name), categories);

    items.push({
      name: name.trim(),
      description,
      price,
      category: resolveCategoryLabel(category, categories),
      allergens: parseAllergens(allergensRaw),
    });
  }

  const categoriesUsed = [
    ...new Set(items.map((item) => normalizeCategoryKey(item.category))),
  ];

  return { items, warnings, categoriesUsed };
}

import type { AiCatalogProduct } from "@/lib/ai/catalog/catalog-types";
import { searchCatalogProducts } from "@/lib/ai/catalog/catalog-search";
import {
  inferServeSizeFromPresets,
  messageImpliesServeSize,
  unionVolumePresets,
} from "@/lib/ai/ordering/serve-size-logic";

const BEER_CATEGORY_PATTERN = /\b(pivo|piva|beer|bier|lager|ale)\b/i;

/** Guest named a specific beer style/brand — not a generic "pivo" order. */
const NAMED_BEER_PATTERN =
  /\b(pils|pilsner|weizen|weiss|wei[sß]|radler|ipa|stout|schneider|heineken|corona|amstel|erdinger|paulaner)\b/i;

const MENU_KNOWLEDGE_PATTERN =
  /\b(sta\s+je|šta\s+je|sta\s+su|šta\s+su|kakv[oa]\s+je|kakv[oa]\s+su|what\s+is|what\s+kind|what\s+type|tell\s+me\s+about|objasni|explain|opisi|opis|describe|reci\s+mi\s+o)\b/i;

const GENERIC_ORDER_TOKENS = new Set([
  "pivo",
  "piva",
  "beer",
  "bier",
  "lager",
  "ale",
  "veliko",
  "velika",
  "velik",
  "malo",
  "mala",
  "small",
  "large",
  "jedno",
  "jedna",
  "jedan",
  "one",
  "dva",
  "tri",
  "two",
  "three",
  "molim",
  "please",
  "hoce",
  "hoću",
  "hocu",
  "zeleo",
  "želeo",
  "zelim",
  "želim",
  "daj",
  "give",
  "want",
  "moze",
  "može",
]);

export function isMenuKnowledgeQuestion(message: string): boolean {
  return MENU_KNOWLEDGE_PATTERN.test(message.trim());
}

export function isGenericBeerCategoryOrder(message: string): boolean {
  const text = message.trim();
  if (!BEER_CATEGORY_PATTERN.test(text)) return false;
  if (NAMED_BEER_PATTERN.test(text)) return false;
  return true;
}

export function findBeerLikeProducts(
  catalog: Record<string, AiCatalogProduct>
): AiCatalogProduct[] {
  const fromSearch = searchCatalogProducts(
    catalog,
    "pivo beer bier pils weizen lager radler ale",
    12
  );
  const drinks = fromSearch.filter((p) => p.menuSection === "drinks");
  if (drinks.length >= 2) return drinks;

  return Object.values(catalog).filter((product) => {
    if (product.menuSection !== "drinks") return false;
    const name = product.name.toLowerCase();
    return NAMED_BEER_PATTERN.test(name) || BEER_CATEGORY_PATTERN.test(name);
  });
}

export function isGenericCategorySegment(segment: string): boolean {
  const tokens = segment
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 3);
  const meaningful = tokens.filter((t) => !GENERIC_ORDER_TOKENS.has(t));
  return meaningful.length === 0 && tokens.some((t) => GENERIC_ORDER_TOKENS.has(t));
}

/**
 * Runtime hint for LLM — size implied, only product choice left; or menu Q&A.
 */
export function buildOrderComprehendHint(
  message: string,
  catalog: Record<string, AiCatalogProduct>
): string | null {
  const trimmed = message.trim();
  if (!trimmed) return null;

  if (isMenuKnowledgeQuestion(trimmed)) {
    return [
      "MENU KNOWLEDGE HINT:",
      "- Guest asks what an item is — answer warmly from MENU text (description, style, brand, e.g. wheat beer / Schneider).",
      '- intent "chat" or "menu_info"; recommendations = [] unless they ask to pick.',
      "- After explaining, one polite line to continue the order — do not reset to generic welcome.",
    ].join("\n");
  }

  if (!isGenericBeerCategoryOrder(trimmed) || !messageImpliesServeSize(trimmed)) {
    return null;
  }

  const beers = findBeerLikeProducts(catalog);
  if (beers.length < 2) return null;

  const presets = unionVolumePresets(beers);
  const inferred = inferServeSizeFromPresets(trimmed, presets);
  if (!inferred) return null;

  const names = beers.map((b) => b.name).join(" | ");
  return [
    "ORDER COMPREHENSION HINT:",
    `- Guest said: "${trimmed}"`,
    `- Size ALREADY implied (veliko/large → largest on menu): ${inferred} — do NOT ask 0.3L vs 0.5L again.`,
    `- ONLY ask which product: ${names}`,
    `- When guest picks, proposedItems MUST include serveSize "${inferred}".`,
  ].join("\n");
}

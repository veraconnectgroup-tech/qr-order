import { AI_CONFIG } from "@/lib/ai/config";
import type { AiCatalogProduct } from "@/lib/ai/catalog/catalog-types";
import type { AiChatRecommendation } from "@/lib/ai/parse-response";
import type { AiProductSummary } from "@/lib/ai/types";
import { formatPrice } from "@/lib/format";

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

const STOP_WORDS = new Set([
  "i",
  "a",
  "to",
  "je",
  "da",
  "ne",
  "mi",
  "vi",
  "we",
  "the",
  "and",
  "or",
  "for",
  "you",
  "your",
  "one",
  "jedan",
  "jedna",
  "jedno",
  "ovaj",
  "ova",
  "ove",
  "that",
  "this",
  "hvala",
  "thanks",
  "please",
  "molim",
  "bitte",
  "ok",
  "okej",
  "okay",
]);

function tokenize(query: string) {
  return normalizeText(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

const ORDER_VERB_PATTERN =
  /po[šs]alji|naru[čc]i|potvrdi|checkout|place\s+order|bestell|senden|confirm|zatvori/i;

const ORDER_INTENT_PATTERN =
  /\b(jedan|jedna|jedno|one|two|dva|tri|three|ho[ćc]u|hocu|want|give\s+me|can\s+i\s+get|mo[žz]e|molim|\d+\s*x)\b/i;

const EXPLICIT_BROWSE_PATTERN =
  /sta\s+(imamo|imate|nudite)|šta\s+(imamo|imate|nudite)|what\s+do\s+you\s+have|show\s+me|predlo[žz]|preporu[čc]|recommend|suggest|surprise|koje\s+|which\s+|options|izbor|imamo\s+li|do\s+you\s+have/i;

const QUICK_REPLY_ANSWER_PATTERN =
  /^(regular|small|large|medium|mini|classic|0\.3l?|0\.5l?|33cl|50cl)$/i;

export function guestAskedForSuggestions(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return false;
  if (ORDER_INTENT_PATTERN.test(trimmed)) return false;
  if (EXPLICIT_BROWSE_PATTERN.test(trimmed)) return true;
  const tokens = tokenize(trimmed);
  return tokens.length === 1 && isLikelyBrowseQuery(trimmed);
}

export function isLikelyBrowseQuery(message: string) {
  const trimmed = message.trim();
  if (!trimmed || trimmed.length > 100) return false;
  if (ORDER_VERB_PATTERN.test(trimmed)) return false;
  if (ORDER_INTENT_PATTERN.test(trimmed)) return false;
  if (/^\d[\d.,]*\s*(l|ml|cl)?$/i.test(trimmed)) return false;
  if (QUICK_REPLY_ANSWER_PATTERN.test(trimmed)) return false;
  return true;
}

export function isExplicitBrowseQuery(message: string): boolean {
  return guestAskedForSuggestions(message) && isLikelyBrowseQuery(message);
}

/** @deprecated Use isExplicitBrowseQuery */
export function isSimpleBrowseQuery(message: string): boolean {
  return isExplicitBrowseQuery(message);
}

export function searchCatalogProducts(
  catalog: Record<string, AiCatalogProduct>,
  query: string,
  maxResults = AI_CONFIG.maxBrowseRecommendations
): AiCatalogProduct[] {
  const tokens = tokenize(query);
  if (!tokens.length) return [];

  const scored: Array<{ product: AiCatalogProduct; score: number }> = [];

  for (const product of Object.values(catalog)) {
    const haystack = normalizeText(product.name);

    let score = 0;
    for (const token of tokens) {
      if (haystack.includes(token)) score += 12;
      if (haystack.split(/\s+/).some((word) => word.startsWith(token))) {
        score += 6;
      }
    }

    if (score > 0) {
      scored.push({ product, score });
    }
  }

  return scored
    .sort(
      (a, b) =>
        b.score - a.score || a.product.name.localeCompare(b.product.name)
    )
    .slice(0, maxResults)
    .map((entry) => entry.product);
}

export function catalogMatchesToRecommendations(
  products: AiCatalogProduct[],
  currency: string
): AiChatRecommendation[] {
  return products.map((product) => ({
    productId: product.id,
    name: product.name,
    price: product.price,
    imageUrl: product.imageUrl,
    reason: formatPrice(product.price, currency),
  }));
}

export function mergeBrowseRecommendations(
  catalogMatches: AiCatalogProduct[],
  productMap: Record<string, AiProductSummary>,
  currency: string,
  existing: AiChatRecommendation[] = []
): AiChatRecommendation[] {
  const merged = new Map<string, AiChatRecommendation>();

  for (const rec of existing) {
    merged.set(rec.productId, rec);
  }

  for (const product of catalogMatches) {
    if (merged.has(product.id)) continue;
    const summary = productMap[product.id];
    if (!summary) continue;
    merged.set(product.id, {
      productId: product.id,
      name: summary.name,
      price: summary.price,
      imageUrl: summary.imageUrl,
      reason: formatPrice(summary.price, currency),
    });
  }

  return [...merged.values()].slice(0, AI_CONFIG.maxBrowseRecommendations);
}

export function buildBrowseMessage(
  products: AiCatalogProduct[],
  language: string
): string {
  const names = products.slice(0, 3).map((product) => product.name);
  const remaining = Math.max(0, products.length - names.length);

  const templates: Record<
    string,
    (names: string[], remaining: number) => string
  > = {
    sr: (n, rest) => {
      if (n.length === 1) return `Imamo ${n[0]}. Klikni + da dodaš.`;
      if (n.length === 2) return `Imamo ${n[0]} i ${n[1]}. Izaberi ispod.`;
      const lead = `${n[0]}, ${n[1]} i ${n[2]}`;
      return rest > 0
        ? `Imamo ${lead} i još ${rest}. Izaberi ispod.`
        : `Imamo ${lead}. Izaberi ispod.`;
    },
    hr: (n, rest) => {
      if (n.length === 1) return `Imamo ${n[0]}. Klikni + za dodati.`;
      if (n.length === 2) return `Imamo ${n[0]} i ${n[1]}. Odaberi ispod.`;
      const lead = `${n[0]}, ${n[1]} i ${n[2]}`;
      return rest > 0
        ? `Imamo ${lead} i još ${rest}. Odaberi ispod.`
        : `Imamo ${lead}. Odaberi ispod.`;
    },
    en: (n, rest) => {
      if (n.length === 1) return `We have ${n[0]}. Tap + to add.`;
      if (n.length === 2) return `We have ${n[0]} and ${n[1]}. Pick below.`;
      const lead = `${n[0]}, ${n[1]}, and ${n[2]}`;
      return rest > 0
        ? `We have ${lead} and ${rest} more. Pick below.`
        : `We have ${lead}. Pick below.`;
    },
    de: (n, rest) => {
      if (n.length === 1) return `Wir haben ${n[0]}. Tippe + zum Hinzufügen.`;
      if (n.length === 2) return `Wir haben ${n[0]} und ${n[1]}. Wähle unten.`;
      const lead = `${n[0]}, ${n[1]} und ${n[2]}`;
      return rest > 0
        ? `Wir haben ${lead} und ${rest} weitere. Wähle unten.`
        : `Wir haben ${lead}. Wähle unten.`;
    },
    fr: (n, rest) => {
      if (n.length === 1) return `Nous avons ${n[0]}. Appuyez sur + pour ajouter.`;
      if (n.length === 2) return `Nous avons ${n[0]} et ${n[1]}. Choisissez ci-dessous.`;
      const lead = `${n[0]}, ${n[1]} et ${n[2]}`;
      return rest > 0
        ? `Nous avons ${lead} et ${rest} de plus. Choisissez ci-dessous.`
        : `Nous avons ${lead}. Choisissez ci-dessous.`;
    },
    es: (n, rest) => {
      if (n.length === 1) return `Tenemos ${n[0]}. Pulsa + para añadir.`;
      if (n.length === 2) return `Tenemos ${n[0]} y ${n[1]}. Elige abajo.`;
      const lead = `${n[0]}, ${n[1]} y ${n[2]}`;
      return rest > 0
        ? `Tenemos ${lead} y ${rest} más. Elige abajo.`
        : `Tenemos ${lead}. Elige abajo.`;
    },
    it: (n, rest) => {
      if (n.length === 1) return `Abbiamo ${n[0]}. Tocca + per aggiungere.`;
      if (n.length === 2) return `Abbiamo ${n[0]} e ${n[1]}. Scegli sotto.`;
      const lead = `${n[0]}, ${n[1]} e ${n[2]}`;
      return rest > 0
        ? `Abbiamo ${lead} e altri ${rest}. Scegli sotto.`
        : `Abbiamo ${lead}. Scegli sotto.`;
    },
    tr: (n, rest) => {
      if (n.length === 1) return `${n[0]} var. Eklemek için + dokunun.`;
      if (n.length === 2) return `${n[0]} ve ${n[1]} var. Aşağıdan seçin.`;
      const lead = `${n[0]}, ${n[1]} ve ${n[2]}`;
      return rest > 0
        ? `${lead} ve ${rest} tane daha var. Aşağıdan seçin.`
        : `${lead} var. Aşağıdan seçin.`;
    },
    ru: (n, rest) => {
      if (n.length === 1) return `У нас есть ${n[0]}. Нажмите +, чтобы добавить.`;
      if (n.length === 2) return `У нас есть ${n[0]} и ${n[1]}. Выберите ниже.`;
      const lead = `${n[0]}, ${n[1]} и ${n[2]}`;
      return rest > 0
        ? `У нас есть ${lead} и ещё ${rest}. Выберите ниже.`
        : `У нас есть ${lead}. Выберите ниже.`;
    },
    ar: (n, rest) => {
      if (n.length === 1) return `لدينا ${n[0]}. اضغط + للإضافة.`;
      if (n.length === 2) return `لدينا ${n[0]} و${n[1]}. اختر أدناه.`;
      const lead = `${n[0]} و${n[1]} و${n[2]}`;
      return rest > 0
        ? `لدينا ${lead} و${rest} أخرى. اختر أدناه.`
        : `لدينا ${lead}. اختر أدناه.`;
    },
  };

  const lang = language.slice(0, 2);
  const template = templates[lang] ?? templates.en;
  return template(names, remaining);
}

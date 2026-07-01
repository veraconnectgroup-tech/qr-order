import type { AiCatalogProduct } from "@/lib/ai/catalog/catalog-types";
import { keyboardProximityScore } from "@/lib/ai/catalog/keyboard-proximity";
import {
  buildPhoneticIndex,
  findPhoneticProductIds,
  phoneticMatchScore,
  type PhoneticIndex,
} from "@/lib/ai/catalog/phonetic-index";
import {
  lookupLearnedTypoCorrection,
  type TypoCorrectionMap,
} from "@/lib/denis/learning/typo-corrections";

export type FuzzyMatchLayer =
  | "exact"
  | "case_insensitive"
  | "levenshtein"
  | "phonetic"
  | "keyboard"
  | "abbreviation"
  | "emoji"
  | "learned";

export type FuzzyMatchResult = {
  productId: string;
  productName: string;
  token: string;
  layer: FuzzyMatchLayer;
  confidence: number;
};

export type FuzzySearchOutcome = {
  matches: FuzzyMatchResult[];
  ambiguous: boolean;
  clarifyOptions: FuzzyMatchResult[];
  shouldAsk: boolean;
  shouldUseDirectly: boolean;
  clarifyPrompt: string | null;
};

export const FUZZY_CONFIDENCE = {
  exact: 1,
  caseInsensitive: 0.95,
  levenshtein1: 0.9,
  levenshtein2: 0.7,
  phonetic: 0.8,
  keyboard: 0.75,
  abbreviation: 0.85,
  emoji: 0.88,
  learned: 1,
  askBelow: 0.6,
  useAbove: 0.8,
} as const;

const COMMON_ABBREVIATIONS: Record<string, string[]> = {
  sch: ["schnitzel"],
  pom: ["pomfrit", "pommes", "pomfrites"],
  bur: ["burger"],
  pil: ["pilsner", "pilav"],
  esp: ["espresso"],
  col: ["cola"],
};

const EMOJI_CATEGORY_KEYWORDS: Record<string, string[]> = {
  "🍺": ["beer", "pivo", "pilsner", "lager", "bier", "weizen"],
  "🍻": ["beer", "pivo", "pilsner", "lager", "bier"],
  "🍔": ["burger"],
  "🍟": ["pomfrit", "pommes", "fries"],
  "☕": ["espresso", "coffee", "kafa", "kaffee"],
  "🥤": ["cola", "soda", "soft"],
  ":beer:": ["beer", "pivo", "pilsner", "lager", "bier"],
  ":burger:": ["burger"],
};

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
  "daj",
  "und",
  "ein",
  "eine",
]);

const NUMBER_WORDS: Record<string, string> = {
  jedan: "1",
  jedna: "1",
  jedno: "1",
  dva: "2",
  tri: "3",
  one: "1",
  two: "2",
  three: "3",
  ein: "1",
  zwei: "2",
  drei: "3",
};

const VOICE_ARTIFACT_SUBSTITUTIONS: Array<[RegExp, string]> = [
  [/^shnitzel$/i, "schnitzel"],
  [/^schnitzl$/i, "schnitzel"],
  [/^borger$/i, "burger"],
  [/^bruger$/i, "burger"],
  [/^coca\s*cola$/i, "cola"],
  [/^koka\s*kola$/i, "cola"],
  [/^kola$/i, "cola"],
];

export function normalizeFuzzyText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function normalizeNumberWords(text: string): string {
  return text
    .split(/\s+/)
    .map((word) => NUMBER_WORDS[normalizeFuzzyText(word)] ?? word)
    .join(" ");
}

export function normalizeVoiceArtifactToken(token: string): string {
  const normalized = normalizeFuzzyText(token);
  for (const [pattern, replacement] of VOICE_ARTIFACT_SUBSTITUTIONS) {
    if (pattern.test(normalized)) return replacement;
  }
  return normalized;
}

export function levenshteinDistance(left: string, right: string): number {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const rows = left.length + 1;
  const cols = right.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 0)
  );

  for (let i = 0; i < rows; i++) matrix[i]![0] = i;
  for (let j = 0; j < cols; j++) matrix[0]![j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost
      );
    }
  }

  return matrix[rows - 1]![cols - 1]!;
}

function levenshteinConfidence(distance: number): number {
  if (distance <= 0) return FUZZY_CONFIDENCE.exact;
  if (distance === 1) return FUZZY_CONFIDENCE.levenshtein1;
  if (distance === 2) return FUZZY_CONFIDENCE.levenshtein2;
  return 0;
}

function extractEmojiTokens(query: string): string[] {
  const tokens: string[] = [];
  for (const emoji of Object.keys(EMOJI_CATEGORY_KEYWORDS)) {
    if (query.includes(emoji)) tokens.push(emoji);
  }
  return tokens;
}

function tokenizeFuzzyQuery(query: string): string[] {
  const normalized = normalizeNumberWords(normalizeFuzzyText(query));
  const rawTokens = normalized
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => normalizeVoiceArtifactToken(token))
    .filter(Boolean);

  const tokens: string[] = [];
  for (const token of rawTokens) {
    if (token.length >= 3 && !STOP_WORDS.has(token)) {
      tokens.push(token);
      continue;
    }
    if (token.length >= 2 && COMMON_ABBREVIATIONS[token]) {
      tokens.push(token);
    }
  }

  for (const emoji of extractEmojiTokens(query)) {
    tokens.push(emoji);
  }

  return tokens;
}

function productWords(product: AiCatalogProduct): string[] {
  return normalizeFuzzyText(product.name)
    .split(/\s+/)
    .filter((word) => word.length >= 2);
}

function matchesEmojiCategory(
  emojiToken: string,
  product: AiCatalogProduct
): boolean {
  const keywords = EMOJI_CATEGORY_KEYWORDS[emojiToken];
  if (!keywords) return false;

  const haystack = normalizeFuzzyText(
    `${product.name} ${product.menuSection ?? ""}`
  );

  return keywords.some((keyword) => haystack.includes(keyword));
}

function matchAbbreviation(
  token: string,
  product: AiCatalogProduct
): number {
  const normalized = normalizeFuzzyText(token);
  if (normalized.length < 2 || normalized.length > 4) return 0;

  const hints = COMMON_ABBREVIATIONS[normalized] ?? [];
  const words = productWords(product);

  for (const word of words) {
    if (word.startsWith(normalized)) {
      return FUZZY_CONFIDENCE.abbreviation;
    }
  }

  for (const hint of hints) {
    if (words.some((word) => word.includes(hint))) {
      return FUZZY_CONFIDENCE.abbreviation;
    }
  }

  return 0;
}

function scoreTokenAgainstProduct(input: {
  token: string;
  product: AiCatalogProduct;
  phoneticIndex: PhoneticIndex;
}): FuzzyMatchResult | null {
  const { token, product } = input;
  const productName = product.name;
  const normalizedName = normalizeFuzzyText(productName);
  const normalizedToken = normalizeFuzzyText(token);

  if (!normalizedToken) return null;

  const candidates: FuzzyMatchResult[] = [];

  if (EMOJI_CATEGORY_KEYWORDS[token] && matchesEmojiCategory(token, product)) {
    candidates.push({
      productId: product.id,
      productName,
      token,
      layer: "emoji",
      confidence: FUZZY_CONFIDENCE.emoji,
    });
  }

  if (normalizedToken === normalizedName) {
    candidates.push({
      productId: product.id,
      productName,
      token,
      layer: "exact",
      confidence: FUZZY_CONFIDENCE.exact,
    });
  }

  const abbrevScore = matchAbbreviation(normalizedToken, product);
  if (abbrevScore > 0) {
    candidates.push({
      productId: product.id,
      productName,
      token,
      layer: "abbreviation",
      confidence: abbrevScore,
    });
  }

  for (const word of productWords(product)) {
    if (word === normalizedToken) {
      candidates.push({
        productId: product.id,
        productName,
        token,
        layer: "exact",
        confidence: FUZZY_CONFIDENCE.exact,
      });
    }

    const distance = levenshteinDistance(normalizedToken, word);
    if (distance > 0 && distance <= 2) {
      candidates.push({
        productId: product.id,
        productName,
        token,
        layer: "levenshtein",
        confidence: levenshteinConfidence(distance),
      });
    }

    const phoneticScore = phoneticMatchScore(normalizedToken, word);
    if (phoneticScore > 0) {
      candidates.push({
        productId: product.id,
        productName,
        token,
        layer: "phonetic",
        confidence: phoneticScore,
      });
    }

    const keyboardScore = keyboardProximityScore(normalizedToken, word);
    if (keyboardScore > 0) {
      candidates.push({
        productId: product.id,
        productName,
        token,
        layer: "keyboard",
        confidence: keyboardScore,
      });
    }

    if (
      normalizedToken.length >= 4 &&
      word.startsWith(normalizedToken) &&
      word !== normalizedToken
    ) {
      candidates.push({
        productId: product.id,
        productName,
        token,
        layer: "case_insensitive",
        confidence: FUZZY_CONFIDENCE.caseInsensitive,
      });
    }
  }

  const phoneticIds = findPhoneticProductIds(normalizedToken, input.phoneticIndex);
  if (phoneticIds.includes(product.id)) {
    candidates.push({
      productId: product.id,
      productName,
      token,
      layer: "phonetic",
      confidence: FUZZY_CONFIDENCE.phonetic,
    });
  }

  const compactName = normalizedName.replace(/\s+/g, "");
  const compactDistance = levenshteinDistance(normalizedToken, compactName);
  if (compactDistance > 0 && compactDistance <= 2) {
    candidates.push({
      productId: product.id,
      productName,
      token,
      layer: "levenshtein",
      confidence: levenshteinConfidence(compactDistance),
    });
  }

  if (!candidates.length) return null;

  return candidates.sort((a, b) => b.confidence - a.confidence)[0]!;
}

function mergeBestMatches(results: FuzzyMatchResult[]): FuzzyMatchResult[] {
  const byProduct = new Map<string, FuzzyMatchResult>();

  for (const result of results) {
    const existing = byProduct.get(result.productId);
    if (!existing || result.confidence > existing.confidence) {
      byProduct.set(result.productId, result);
    }
  }

  return [...byProduct.values()].sort(
    (a, b) =>
      b.confidence - a.confidence ||
      a.productName.localeCompare(b.productName)
  );
}

export function buildFuzzyClarifyPrompt(
  options: FuzzyMatchResult[],
  language = "sr"
): string {
  if (options.length === 0) return "";
  if (options.length === 1) {
    const name = options[0]!.productName;
    if (language === "en") return `Did you mean ${name}?`;
    if (language === "de") return `Meinten Sie ${name}?`;
    return `Mislite li na ${name}?`;
  }

  const names = options.slice(0, 2).map((row) => row.productName);
  if (language === "en") return `${names[0]} or ${names[1]}?`;
  if (language === "de") return `${names[0]} oder ${names[1]}?`;
  return `${names[0]} ili ${names[1]}?`;
}

export function resolveFuzzySearchOutcome(
  matches: FuzzyMatchResult[],
  language = "sr"
): FuzzySearchOutcome {
  const merged = mergeBestMatches(matches);
  const top = merged[0] ?? null;
  const second = merged[1] ?? null;

  const ambiguous =
    Boolean(top && second) &&
    top!.confidence >= FUZZY_CONFIDENCE.askBelow &&
    second!.confidence >= FUZZY_CONFIDENCE.askBelow &&
    top!.confidence - second!.confidence <= 0.1;

  const clarifyOptions = ambiguous
    ? [top!, second!]
    : top && top.confidence < FUZZY_CONFIDENCE.useAbove
      ? [top]
      : [];

  const shouldAsk =
    clarifyOptions.length > 0 &&
    (ambiguous || (top?.confidence ?? 0) < FUZZY_CONFIDENCE.askBelow);

  const shouldUseDirectly =
    Boolean(top) &&
    top!.confidence >= FUZZY_CONFIDENCE.useAbove &&
    !ambiguous;

  return {
    matches: merged,
    ambiguous,
    clarifyOptions,
    shouldAsk,
    shouldUseDirectly,
    clarifyPrompt: clarifyOptions.length
      ? buildFuzzyClarifyPrompt(clarifyOptions, language)
      : null,
  };
}

export function fuzzyMatchCatalog(input: {
  catalog: Record<string, AiCatalogProduct>;
  query: string;
  learnedCorrections?: TypoCorrectionMap;
  phoneticIndex?: PhoneticIndex;
  language?: string;
}): FuzzySearchOutcome {
  const phoneticIndex =
    input.phoneticIndex ?? buildPhoneticIndex(input.catalog);
  const tokens = tokenizeFuzzyQuery(input.query);
  const results: FuzzyMatchResult[] = [];

  if (!tokens.length) {
    return resolveFuzzySearchOutcome([], input.language);
  }

  for (const token of tokens) {
    const learned = lookupLearnedTypoCorrection(
      input.learnedCorrections,
      token
    );
    if (learned) {
      results.push({
        productId: learned.productId,
        productName: learned.productName,
        token,
        layer: "learned",
        confidence: FUZZY_CONFIDENCE.learned,
      });
      continue;
    }

    for (const product of Object.values(input.catalog)) {
      const match = scoreTokenAgainstProduct({
        token,
        product,
        phoneticIndex,
      });
      if (match) results.push(match);
    }
  }

  return resolveFuzzySearchOutcome(results, input.language);
}

export function fuzzyMatchCatalogProducts(
  catalog: Record<string, AiCatalogProduct>,
  query: string,
  options?: {
    maxResults?: number;
    learnedCorrections?: TypoCorrectionMap;
    phoneticIndex?: PhoneticIndex;
    language?: string;
  }
): FuzzySearchOutcome {
  const outcome = fuzzyMatchCatalog({
    catalog,
    query,
    learnedCorrections: options?.learnedCorrections,
    phoneticIndex: options?.phoneticIndex,
    language: options?.language,
  });

  const maxResults = options?.maxResults ?? 12;
  return {
    ...outcome,
    matches: outcome.matches.slice(0, maxResults),
    clarifyOptions: outcome.clarifyOptions.slice(0, 2),
  };
}

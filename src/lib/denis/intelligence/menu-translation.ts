export type MenuItem = {
  id: string;
  name: string;
  description: string;
  /** Admin-entered static translations keyed by language code. */
  translations?: Partial<
    Record<
      string,
      {
        name?: string;
        description?: string;
      }
    >
  >;
};

export type TranslatedMenuItem = {
  id: string;
  originalName: string;
  translatedName: string;
  originalDescription: string;
  translatedDescription: string;
  language: string;
  cached: boolean;
  /** static = admin row, llm = model translation, identity = same language */
  source: "static" | "cache" | "llm" | "identity";
};

/** productId → language → translation */
export type TranslationCache = Map<string, Map<string, TranslatedMenuItem>>;

export function translationCacheKey(productId: string, language: string): string {
  return `${productId}:${language.toLowerCase().slice(0, 2)}`;
}

function readCachedTranslation(
  cache: TranslationCache,
  productId: string,
  language: string
): TranslatedMenuItem | null {
  const lang = language.toLowerCase().slice(0, 2);
  return cache.get(productId)?.get(lang) ?? null;
}

function writeCachedTranslation(
  cache: TranslationCache,
  item: TranslatedMenuItem
): void {
  const lang = item.language.toLowerCase().slice(0, 2);
  let productMap = cache.get(item.id);
  if (!productMap) {
    productMap = new Map();
    cache.set(item.id, productMap);
  }
  productMap.set(lang, item);
}

function resolveStaticTranslation(
  item: MenuItem,
  targetLanguage: string
): { name: string | null; description: string | null } {
  const lang = targetLanguage.toLowerCase().slice(0, 2);
  const row = item.translations?.[lang];
  return {
    name: row?.name?.trim() || null,
    description: row?.description?.trim() || null,
  };
}

/** Map guest product row to MenuItem including admin static translations. */
export function buildMenuItemFromProduct(product: {
  id: string;
  name: string;
  description?: string | null;
  name_en?: string | null;
  description_en?: string | null;
}): MenuItem {
  const translations: NonNullable<MenuItem["translations"]> = {};
  if (product.name_en?.trim()) {
    translations.en = {
      name: product.name_en.trim(),
      description: product.description_en?.trim() || undefined,
    };
  }

  return {
    id: product.id,
    name: product.name,
    description: product.description ?? "",
    translations: Object.keys(translations).length ? translations : undefined,
  };
}

export type LlmTranslateFn = (input: {
  name: string;
  description: string;
  targetLanguage: string;
}) => Promise<{ name: string; description: string }>;

async function llmTranslateItem(
  item: MenuItem,
  targetLanguage: string,
  translate?: LlmTranslateFn
): Promise<{ name: string; description: string }> {
  if (translate) {
    return translate({
      name: item.name,
      description: item.description,
      targetLanguage,
    });
  }

  return {
    name: item.name,
    description: item.description,
  };
}

/** Items without static translation and not yet cached — need LLM batch. */
export function collectItemsNeedingLlmTranslation(input: {
  menu: MenuItem[];
  targetLanguage: string;
  cache: TranslationCache;
  sourceLanguage?: string;
}): MenuItem[] {
  const lang = input.targetLanguage.toLowerCase().slice(0, 2);
  const source = (input.sourceLanguage ?? "de").toLowerCase().slice(0, 2);
  if (lang === source) return [];

  return input.menu.filter((item) => {
    if (readCachedTranslation(input.cache, item.id, lang)) return false;
    const staticRow = resolveStaticTranslation(item, lang);
    return !staticRow.name;
  });
}

export async function translateMenuItemForGuest(input: {
  item: MenuItem;
  targetLanguage: string;
  cache: TranslationCache;
  translate?: LlmTranslateFn;
  sourceLanguage?: string;
  preloadedLlm?: Map<string, { name: string; description: string }>;
}): Promise<TranslatedMenuItem> {
  const lang = input.targetLanguage.toLowerCase().slice(0, 2);
  const source = (input.sourceLanguage ?? "de").toLowerCase().slice(0, 2);

  if (lang === source) {
    return {
      id: input.item.id,
      originalName: input.item.name,
      translatedName: input.item.name,
      originalDescription: input.item.description,
      translatedDescription: input.item.description,
      language: lang,
      cached: false,
      source: "identity",
    };
  }

  const cached = readCachedTranslation(input.cache, input.item.id, lang);
  if (cached) {
    return { ...cached, cached: true, source: "cache" };
  }

  const staticTranslation = resolveStaticTranslation(input.item, lang);
  if (staticTranslation.name) {
    const translated: TranslatedMenuItem = {
      id: input.item.id,
      originalName: input.item.name,
      translatedName: staticTranslation.name,
      originalDescription: input.item.description,
      translatedDescription:
        staticTranslation.description ?? input.item.description,
      language: lang,
      cached: false,
      source: "static",
    };
    writeCachedTranslation(input.cache, translated);
    return translated;
  }

  const preloaded = input.preloadedLlm?.get(input.item.id);
  const llm = preloaded
    ? preloaded
    : await llmTranslateItem(input.item, lang, input.translate);

  const translated: TranslatedMenuItem = {
    id: input.item.id,
    originalName: input.item.name,
    translatedName: llm.name,
    originalDescription: input.item.description,
    translatedDescription: llm.description,
    language: lang,
    cached: false,
    source: "llm",
  };
  writeCachedTranslation(input.cache, translated);
  return translated;
}

export async function translateMenuForGuest(input: {
  menu: MenuItem[];
  targetLanguage: string;
  cache: TranslationCache;
  translate?: LlmTranslateFn;
  sourceLanguage?: string;
  preloadedLlm?: Map<string, { name: string; description: string }>;
}): Promise<TranslatedMenuItem[]> {
  return Promise.all(
    input.menu.map((item) =>
      translateMenuItemForGuest({
        item,
        targetLanguage: input.targetLanguage,
        cache: input.cache,
        translate: input.translate,
        sourceLanguage: input.sourceLanguage,
        preloadedLlm: input.preloadedLlm,
      })
    )
  );
}

export function formatHybridMenuLine(item: TranslatedMenuItem): string {
  if (item.originalName === item.translatedName) {
    return `${item.translatedName}\n${item.translatedDescription}`;
  }
  return `${item.originalName}\n${item.translatedName}\n${item.translatedDescription}`;
}

export function formatDualLanguageName(item: TranslatedMenuItem): {
  primary: string;
  secondary: string | null;
} {
  if (item.originalName === item.translatedName) {
    return { primary: item.originalName, secondary: null };
  }
  return { primary: item.originalName, secondary: item.translatedName };
}

export function formatDualLanguageDescription(item: TranslatedMenuItem): {
  primary: string | null;
  secondary: string | null;
} {
  const original = item.originalDescription.trim();
  const translated = item.translatedDescription.trim();
  if (!original && !translated) return { primary: null, secondary: null };
  if (!translated || original === translated) {
    return { primary: original || null, secondary: null };
  }
  return { primary: original, secondary: translated };
}

/** Tourist mode — original menu name + parenthetical guest-language explanation. */
export function formatParentheticalMenuRecommendation(input: {
  item: TranslatedMenuItem;
  leadIn?: string;
}): string {
  const { item, leadIn = "I recommend" } = input;
  const explanation =
    item.translatedDescription.trim() ||
    item.translatedName.trim() ||
    item.originalDescription.trim();

  if (item.originalName === item.translatedName) {
    return `${leadIn} the ${item.originalName}.`;
  }

  if (!explanation || explanation === item.originalName) {
    return `${leadIn} the ${item.originalName} (${item.translatedName}).`;
  }

  return `${leadIn} the ${item.originalName} (${explanation}).`;
}

export function formatTouristMenuLine(
  item: TranslatedMenuItem,
  options?: { parenthetical?: boolean }
): string {
  if (!options?.parenthetical) {
    return formatHybridMenuLine(item);
  }

  const name =
    item.originalName === item.translatedName
      ? item.originalName
      : `${item.originalName} (${item.translatedName})`;

  const description =
    item.originalDescription === item.translatedDescription
      ? item.translatedDescription
      : item.translatedDescription.trim()
        ? `${item.originalDescription} (${item.translatedDescription})`
        : item.originalDescription;

  return `${name}\n${description}`.trim();
}

export function invalidateMenuTranslationCache(
  cache: TranslationCache,
  productIds: string[]
): void {
  for (const productId of productIds) {
    cache.delete(productId);
  }
}

export function createTranslationCache(): TranslationCache {
  return new Map();
}

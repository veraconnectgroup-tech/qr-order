import { createHash } from "node:crypto";

import { AI_CONFIG } from "@/lib/ai/config";
import { embedTextsWithOpenAi } from "@/lib/ai/embeddings/openai-embeddings";
import type { AiCatalogProduct } from "@/lib/ai/catalog/catalog-types";
import { getAiRedis } from "@/lib/ai/redis";
import { logRedisDegradation } from "@/lib/redis/client";
import { logger } from "@/lib/logger";
import type {
  MenuRagCatalog,
  MenuRagEmbeddingBundle,
  MenuRagEmbeddingIndex,
  MenuRagEmbeddingSpace,
} from "@/lib/denis/cognition/context/menu-rag-types";

const LOCAL_EMBED_DIM = 96;

/** Lightweight semantic aliases for offline eval + gateway fallback. */
const MENU_RAG_SEMANTIC_EXPANSIONS: Record<string, readonly string[]> = {
  lagano: ["lagana", "light", "leicht", "salata", "salad", "supa", "soup"],
  lagana: ["lagano", "light", "leicht", "salata", "salad"],
  light: ["lagano", "lagana", "salad", "salata"],
  teško: ["teški", "heavy", "burger", "steak", "jelo"],
  teški: ["teško", "heavy", "burger", "steak"],
  bez: ["free", "frei", "without", "no"],
  glutena: ["gluten", "glutenfree", "glutenfrei"],
  pivo: ["beer", "lager", "pilsner", "radler", "ale"],
  vegan: ["plant", "biljno", "vegetarijanski"],
};

type MenuRagEmbeddingCachePayload = {
  catalogVersion: string;
  model: string;
  space: MenuRagEmbeddingSpace;
  vectors: MenuRagEmbeddingIndex;
  cachedAt: string;
};

function menuRagEmbeddingCacheKey(locationId: string): string {
  return `${AI_CONFIG.menuRagEmbeddingCacheKeyPrefix}${locationId}`;
}

function normalizeEmbedText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function expandEmbedTokens(tokens: string[]): string[] {
  const expanded = new Set<string>();
  for (const token of tokens) {
    expanded.add(token);
    for (const alias of MENU_RAG_SEMANTIC_EXPANSIONS[token] ?? []) {
      expanded.add(alias);
    }
  }
  return [...expanded];
}

function tokenizeEmbedText(value: string): string[] {
  const tokens = normalizeEmbedText(value)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 3);
  return expandEmbedTokens(tokens);
}

function hashToken(token: string): number {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizeVector(values: number[]): number[] {
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  if (magnitude <= 0) return values;
  return values.map((value) => value / magnitude);
}

/** Deterministic local vectors — used in eval and when OpenAI is unavailable. */
export function embedMenuTextLocal(text: string): number[] {
  const vec = new Array<number>(LOCAL_EMBED_DIM).fill(0);
  for (const token of tokenizeEmbedText(text)) {
    const hash = hashToken(token);
    for (let i = 0; i < LOCAL_EMBED_DIM; i++) {
      const sign = (hash >> (i % 32)) & 1 ? 1 : -1;
      vec[i] += sign;
    }
  }
  return normalizeVector(vec);
}

export function buildMenuProductEmbedText(product: AiCatalogProduct): string {
  const allergenPart =
    product.allergens.length > 0
      ? ` | allergens: ${product.allergens.join(", ")}`
      : "";
  return `${product.name} | section: ${product.menuSection}${allergenPart}`;
}

export function buildMenuQueryEmbedText(query: string): string {
  return tokenizeEmbedText(query).join(" ");
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  if (length === 0) return 0;

  let dot = 0;
  for (let i = 0; i < length; i++) {
    dot += a[i]! * b[i]!;
  }
  return dot;
}

export function hashMenuRagCatalogVersion(catalog: MenuRagCatalog): string {
  const fingerprint = Object.values(catalog)
    .map((product) => `${product.id}:${product.name}:${product.menuSection}`)
    .sort()
    .join("|");
  return createHash("sha256").update(fingerprint).digest("hex").slice(0, 16);
}

async function embedMenuTexts(texts: string[]): Promise<{
  vectors: number[][];
  space: MenuRagEmbeddingSpace;
}> {
  if (!texts.length) return { vectors: [], space: "local" };

  try {
    return {
      vectors: await embedTextsWithOpenAi(texts),
      space: "openai",
    };
  } catch (error) {
    logger.warn("Menu RAG OpenAI embeddings unavailable, using local vectors", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      vectors: texts.map((text) => embedMenuTextLocal(text)),
      space: "local",
    };
  }
}

export async function buildMenuRagEmbeddingIndex(
  catalog: MenuRagCatalog
): Promise<MenuRagEmbeddingBundle> {
  const products = Object.values(catalog);
  if (!products.length) return { index: {}, space: "local" };

  const texts = products.map((product) => buildMenuProductEmbedText(product));
  const { vectors, space } = await embedMenuTexts(texts);

  const index: MenuRagEmbeddingIndex = {};
  for (let i = 0; i < products.length; i++) {
    const product = products[i]!;
    const vector = vectors[i];
    if (vector?.length) {
      index[product.id] = vector;
    }
  }
  return { index, space };
}

export async function ensureMenuRagEmbeddings(
  locationId: string,
  catalog: MenuRagCatalog
): Promise<MenuRagEmbeddingBundle> {
  const catalogVersion = hashMenuRagCatalogVersion(catalog);
  const redis = getAiRedis();
  const cacheKey = menuRagEmbeddingCacheKey(locationId);

  if (redis) {
    try {
      const cached = await redis.get<MenuRagEmbeddingCachePayload>(cacheKey);
      if (
        cached?.vectors &&
        cached.catalogVersion === catalogVersion &&
        Object.keys(cached.vectors).length > 0
      ) {
        logger.info("Menu RAG embedding cache hit", { locationId });
        return {
          index: cached.vectors,
          space: cached.space ?? "local",
        };
      }
    } catch (error) {
      logRedisDegradation(`menu-rag-emb:read:${locationId}`, error);
    }
  }

  const bundle = await buildMenuRagEmbeddingIndex(catalog);

  if (redis && Object.keys(bundle.index).length > 0) {
    const payload: MenuRagEmbeddingCachePayload = {
      catalogVersion,
      model: AI_CONFIG.embeddingModel,
      space: bundle.space,
      vectors: bundle.index,
      cachedAt: new Date().toISOString(),
    };
    try {
      await redis.set(cacheKey, payload, {
        ex: AI_CONFIG.menuRagEmbeddingCacheTtlSeconds,
      });
      logger.info("Menu RAG embedding cache set", {
        locationId,
        productCount: Object.keys(bundle.index).length,
        space: bundle.space,
      });
    } catch (error) {
      logRedisDegradation(`menu-rag-emb:write:${locationId}`, error);
    }
  }

  return bundle;
}

export function rankMenuRagProductsByEmbedding(
  catalog: MenuRagCatalog,
  query: string,
  embeddings: MenuRagEmbeddingIndex,
  maxResults: number,
  queryVector?: number[]
): AiCatalogProduct[] {
  const vector =
    queryVector?.length ? queryVector : embedMenuTextLocal(buildMenuQueryEmbedText(query));
  const scored: Array<{ product: AiCatalogProduct; score: number }> = [];

  for (const product of Object.values(catalog)) {
    const productVector = embeddings[product.id];
    if (!productVector?.length) continue;
    scored.push({
      product,
      score: cosineSimilarity(vector, productVector),
    });
  }

  return scored
    .filter((row) => row.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || a.product.name.localeCompare(b.product.name)
    )
    .slice(0, maxResults)
    .map((row) => row.product);
}

export async function embedMenuQueryVector(
  query: string,
  space: MenuRagEmbeddingSpace
): Promise<number[]> {
  const text = buildMenuQueryEmbedText(query);
  if (space === "local") {
    return embedMenuTextLocal(text);
  }

  try {
    const [vector] = await embedTextsWithOpenAi([text]);
    if (vector?.length) return vector;
  } catch {
    // fall through to deterministic local vectors
  }
  return embedMenuTextLocal(text);
}

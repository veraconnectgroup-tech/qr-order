import { AI_CONFIG, isOpenAiConfigured, menuLanguageLabel } from "@/lib/ai/config";
import { callOpenAiChat } from "@/lib/ai/openai-client";
import { getAiRedis } from "@/lib/ai/redis";
import { logger } from "@/lib/logger";
import type { MenuItem } from "@/lib/denis/intelligence/menu-translation";

const REDIS_KEY_PREFIX = "ai:menu-tr:";
const REDIS_TTL_SECONDS = 7 * 24 * 60 * 60;

export type CachedMenuTranslation = {
  name: string;
  description: string;
};

function redisKey(locationId: string, productId: string, language: string): string {
  const lang = language.toLowerCase().slice(0, 2);
  return `${REDIS_KEY_PREFIX}${locationId}:${productId}:${lang}`;
}

export async function readRedisMenuTranslation(
  locationId: string,
  productId: string,
  language: string
): Promise<CachedMenuTranslation | null> {
  const redis = getAiRedis();
  if (!redis) return null;

  try {
    return (
      (await redis.get<CachedMenuTranslation>(
        redisKey(locationId, productId, language)
      )) ?? null
    );
  } catch (error) {
    logger.warn("menu-translation redis read failed", {
      locationId,
      productId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function writeRedisMenuTranslation(
  locationId: string,
  productId: string,
  language: string,
  value: CachedMenuTranslation
): Promise<void> {
  const redis = getAiRedis();
  if (!redis) return;

  try {
    await redis.set(redisKey(locationId, productId, language), value, {
      ex: REDIS_TTL_SECONDS,
    });
  } catch (error) {
    logger.warn("menu-translation redis write failed", {
      locationId,
      productId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

type LlmBatchRow = { id: string; name: string; description: string };

function parseLlmBatchResponse(
  content: string,
  expectedIds: Set<string>
): Map<string, CachedMenuTranslation> {
  const out = new Map<string, CachedMenuTranslation>();
  try {
    const parsed = JSON.parse(content) as {
      items?: Array<{ id?: string; name?: string; description?: string }>;
    };
    for (const row of parsed.items ?? []) {
      const id = row.id?.trim();
      const name = row.name?.trim();
      if (!id || !name || !expectedIds.has(id)) continue;
      out.set(id, {
        name,
        description: row.description?.trim() ?? "",
      });
    }
  } catch {
    return out;
  }
  return out;
}

/** Batch LLM translate menu rows — server only (Prompt 38). */
export async function llmTranslateMenuBatch(input: {
  items: MenuItem[];
  targetLanguage: string;
  sourceLanguage: string;
}): Promise<Map<string, CachedMenuTranslation>> {
  const result = new Map<string, CachedMenuTranslation>();
  if (!input.items.length) return result;

  if (!isOpenAiConfigured()) {
    for (const item of input.items) {
      result.set(item.id, { name: item.name, description: item.description });
    }
    return result;
  }

  const targetLabel = menuLanguageLabel(input.targetLanguage);
  const sourceLabel = menuLanguageLabel(input.sourceLanguage);
  const payload: LlmBatchRow[] = input.items.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
  }));

  try {
    const response = await callOpenAiChat(
      [
        {
          role: "system",
          content: `You translate restaurant menu items from ${sourceLabel} to ${targetLabel}.
Return strict JSON: { "items": [{ "id": "uuid", "name": "...", "description": "..." }] }.
Rules:
- Translate names naturally for the target locale (e.g. Wiener Schnitzel → Viennese Schnitzel).
- Keep descriptions concise — menu style, not marketing copy.
- One output row per input id; never invent ids.`,
        },
        { role: "user", content: JSON.stringify(payload) },
      ],
      { model: AI_CONFIG.fallbackModel }
    );

    const expectedIds = new Set(input.items.map((row) => row.id));
    const parsed = parseLlmBatchResponse(response.content, expectedIds);

    for (const item of input.items) {
      const translated = parsed.get(item.id);
      result.set(
        item.id,
        translated ?? { name: item.name, description: item.description }
      );
    }
  } catch (error) {
    logger.warn("menu-translation LLM batch failed", {
      count: input.items.length,
      targetLanguage: input.targetLanguage,
      error: error instanceof Error ? error.message : String(error),
    });
    for (const item of input.items) {
      result.set(item.id, { name: item.name, description: item.description });
    }
  }

  return result;
}

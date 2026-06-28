import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { verifyAiGuestContext } from "@/lib/ai/verify-guest-context";
import {
  collectItemsNeedingLlmTranslation,
  createTranslationCache,
  translateMenuForGuest,
  type MenuItem,
  type TranslatedMenuItem,
} from "@/lib/denis/intelligence/menu-translation";
import {
  llmTranslateMenuBatch,
  readRedisMenuTranslation,
  writeRedisMenuTranslation,
} from "@/lib/denis/runtime/perceive/menu-translation-llm";
import { withRateLimitByKey } from "@/lib/rate-limit";
import { zSessionToken, zUuid } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";

const menuItemSchema = z.object({
  id: zUuid(),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000),
  translations: z
    .record(
      z.string(),
      z.object({
        name: z.string().trim().max(200).optional(),
        description: z.string().trim().max(2000).optional(),
      })
    )
    .optional(),
});

const bodySchema = z.object({
  locationId: zUuid(),
  tableId: zUuid(),
  sessionToken: zSessionToken(),
  targetLanguage: z.string().trim().min(2).max(10),
  sourceLanguage: z.string().trim().min(2).max(10),
  items: z.array(menuItemSchema).min(1).max(120),
});

async function resolveLlmTranslations(input: {
  locationId: string;
  items: MenuItem[];
  targetLanguage: string;
  sourceLanguage: string;
}): Promise<Map<string, { name: string; description: string }>> {
  const lang = input.targetLanguage.toLowerCase().slice(0, 2);
  const out = new Map<string, { name: string; description: string }>();
  const pending: MenuItem[] = [];

  for (const item of input.items) {
    const cached = await readRedisMenuTranslation(
      input.locationId,
      item.id,
      lang
    );
    if (cached) {
      out.set(item.id, cached);
    } else {
      pending.push(item);
    }
  }

  if (!pending.length) return out;

  const batch = await llmTranslateMenuBatch({
    items: pending,
    targetLanguage: input.targetLanguage,
    sourceLanguage: input.sourceLanguage,
  });

  for (const [productId, row] of batch.entries()) {
    out.set(productId, row);
    await writeRedisMenuTranslation(input.locationId, productId, lang, row);
  }

  return out;
}

/** Real-time menu translation for guest language (Prompt 38). */
export const POST = withErrorHandler("guest-menu-translate", async (req) => {
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid input.", 400);
  }

  const limited = await withRateLimitByKey("ai", parsed.data.sessionToken);
  if (limited) return limited;

  const admin = createAdminClient();
  const guestContext = await verifyAiGuestContext(admin, parsed.data);
  if ("error" in guestContext) {
    return apiError(guestContext.error, guestContext.status);
  }

  const cache = createTranslationCache();
  const needingLlm = collectItemsNeedingLlmTranslation({
    menu: parsed.data.items,
    targetLanguage: parsed.data.targetLanguage,
    cache,
    sourceLanguage: parsed.data.sourceLanguage,
  });

  const preloadedLlm = needingLlm.length
    ? await resolveLlmTranslations({
        locationId: parsed.data.locationId,
        items: needingLlm,
        targetLanguage: parsed.data.targetLanguage,
        sourceLanguage: parsed.data.sourceLanguage,
      })
    : new Map<string, { name: string; description: string }>();

  const translated: TranslatedMenuItem[] = await translateMenuForGuest({
    menu: parsed.data.items,
    targetLanguage: parsed.data.targetLanguage,
    cache,
    sourceLanguage: parsed.data.sourceLanguage,
    preloadedLlm,
  });

  return apiSuccess({ items: translated });
});

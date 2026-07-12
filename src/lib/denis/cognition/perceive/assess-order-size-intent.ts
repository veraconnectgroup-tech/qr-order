import { isOpenAiConfigured } from "@/lib/ai/config";
import { callOpenAiChat } from "@/lib/ai/openai-client";
import type { OpenAiChatMessage } from "@/lib/ai/types";
import { logger } from "@/lib/logger";
import {
  OrderSizeIntentAssessmentSchema,
  type OrderSizeIntentAssessment,
} from "@/lib/ai/ordering/order-size-intent-types";

/**
 * Pure perception — real LLM understanding of the guest's own language,
 * never a fixed word list. See order-size-intent-types.ts for the full
 * reasoning. Runs on every guest turn where a size-relevant order might
 * be in play (same "no keyword gate, let the LLM actually look" posture
 * established for assess-guest-conduct.ts) — never decides whether to
 * act on it; resolve-order-size-hint.ts does that, re-grounded against
 * the real catalog.
 */
function buildAssessmentMessages(message: string): OpenAiChatMessage[] {
  const system = [
    "You classify ONE restaurant guest's chat message for three things: (1) are they asking what an item IS/means, not trying to order at all (e.g. \"what's a Weizen\", \"is that spicy\")? (2) does it name a specific menu item, or ask generically for a category (e.g. \"a beer\", \"some wine\") without naming one? (3) does it express a size preference — bigger or smaller than default — in ANY language or phrasing (not just English/Serbian/German words you might expect)?",
    "You understand many languages — use your own judgment on size words and question phrasing, not a fixed list. A guest might write in any language, with typos, slang, or grammatical variation.",
    "isMenuKnowledgeQuestion: true only if they're asking ABOUT an item (what/how/does-it-contain), not ordering it.",
    "namesSpecificProduct + productNameGuess: true and the item name (best guess, however they wrote it) if ONE specific item is named. Otherwise false and null.",
    "isGenericDrinkRequest + genericCategoryGuess: true and a short English category label (beer, wine, juice, coffee, soda, water, cocktail, etc.) if they asked for a drink category generically. Otherwise false and null.",
    "sizePreference: \"larger\" or \"smaller\" if any size preference is expressed (in any language/wording), otherwise \"unspecified\". Never guess a preference that isn't there.",
    "confidence: your own calibration, 0 to 1 — be honest.",
    "quotedSpan: the exact substring that justified your answer.",
    'JSON only: {"isMenuKnowledgeQuestion":false,"namesSpecificProduct":false,"productNameGuess":null,"isGenericDrinkRequest":true,"genericCategoryGuess":"beer","sizePreference":"unspecified","confidence":0.9,"quotedSpan":"..."}',
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: message },
  ];
}

export async function assessOrderSizeIntent(
  message: string
): Promise<OrderSizeIntentAssessment | null> {
  const trimmed = message.trim();
  if (!trimmed || !isOpenAiConfigured()) return null;

  try {
    const result = await callOpenAiChat(buildAssessmentMessages(trimmed));
    const raw = JSON.parse(result.content) as unknown;
    const parsed = OrderSizeIntentAssessmentSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch (error) {
    logger.warn("assessOrderSizeIntent failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

import { isOpenAiConfigured } from "@/lib/ai/config";
import { callOpenAiChat } from "@/lib/ai/openai-client";
import type { OpenAiChatMessage } from "@/lib/ai/types";
import { logger } from "@/lib/logger";
import {
  OrderSegmentsAssessmentSchema,
  type OrderSegmentsAssessment,
} from "@/lib/ai/ordering/order-segments-types";

/**
 * Pure perception — genuine LLM understanding of a guest's order message,
 * never a fixed split-on-conjunction pattern. See order-segments-types.ts
 * for the full reasoning. This is the recovery path used when the main
 * turn's own proposedItems came back empty on an order-shaped message —
 * a focused, single-purpose extraction call, never deciding a consequence;
 * resolveOrderSegments (order-message-backfill.ts) re-grounds every guess
 * against the real catalog before it's trusted.
 */
function buildAssessmentMessages(message: string): OpenAiChatMessage[] {
  const system = [
    "You extract the individual items a restaurant guest is ordering from ONE chat message, in whatever language they wrote. This is a recovery step — treat it as your only chance to catch every item, so read carefully, do not skip anything, and do not invent anything not implied by the text.",
    "isOrderPlacement: true only if the guest is actually naming item(s) to order (not asking a question, not confirming, not chit-chat).",
    "segments: one entry per distinct item/line the guest wants. quantity defaults to 1 if not stated. personaHint captures who it's for if stated (\"for my wife\", \"za dete\"), else null.",
    "productNameGuess: the specific item name, however the guest wrote it (best-guess spelling/normalization), or null if they only named a category.",
    "isGenericCategory + categoryGuess: true and a short English category label (beer, wine, coffee, tea, juice, soda, water, cocktail, etc.) when the guest asked for a category generically without naming one specific product (e.g. \"a beer\", \"nešto slatko za piće\") — otherwise false and null.",
    "modifierText: any modifier/substitution/preference phrase attached to THIS item, in the guest's own words (e.g. \"bez luka\", \"umesto pomfrita salata\"), or null.",
    "confidence: your own honest calibration, 0 to 1.",
    "Never invent a product name that isn't implied by the text. You understand many languages — use your own judgment, not a fixed word list.",
    'JSON only: {"isOrderPlacement":true,"segments":[{"quotedSpan":"...","quantity":1,"personaHint":null,"productNameGuess":null,"isGenericCategory":true,"categoryGuess":"beer","modifierText":null}],"confidence":0.9}',
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: message },
  ];
}

export async function assessOrderSegments(
  message: string
): Promise<OrderSegmentsAssessment | null> {
  const trimmed = message.trim();
  if (!trimmed || !isOpenAiConfigured()) return null;

  try {
    const result = await callOpenAiChat(buildAssessmentMessages(trimmed));
    const raw = JSON.parse(result.content) as unknown;
    const parsed = OrderSegmentsAssessmentSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch (error) {
    logger.warn("assessOrderSegments failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

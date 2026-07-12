import { z } from "zod";
import { AI_CONFIG } from "@/lib/ai/config";
import type { AiProductSummary, AiStructuredResponse } from "@/lib/ai/types";
import { zUuid } from "@/lib/security/zod-fields";
import { normalizeTurnInterpretation } from "@/lib/denis/cognition/tde/extract-turn-interpretation";

const proposedItemSchema = z.object({
  productId: zUuid(),
  quantity: z.number().int().min(1).max(10).optional().default(1),
  modifierIds: z.array(zUuid()).optional().default([]),
  serveSize: z.string().trim().max(20).nullable().optional(),
  notes: z.string().trim().max(200).optional().default(""),
});

const turnInterpretationSchema = z
  .object({
    sentiment: z
      .enum(["positive", "neutral", "frustrated", "confused"])
      .optional()
      .default("neutral"),
    mealStage: z
      .enum([
        "pre_order",
        "ordering",
        "waiting",
        "eating",
        "dessert",
        "paying",
      ])
      .nullable()
      .optional()
      .default(null),
    modifications: z
      .array(
        z.object({
          swap: z
            .object({ from: z.string(), to: z.string() })
            .optional(),
          remove: z.string().optional(),
          add: z.string().optional(),
          modifier: z.string().optional(),
          cooking: z.string().optional(),
        })
      )
      .max(8)
      .optional()
      .default([]),
    preferences: z.array(z.string().trim().max(120)).max(8).optional().default([]),
    followUpMinutes: z.number().int().min(1).max(480).nullable().optional(),
    partySize: z.number().int().min(1).max(40).nullable().optional(),
    awaiting: z.string().nullable().optional(),
    askedDessert: z.boolean().optional().default(false),
    sidePreference: z.string().nullable().optional(),
    cookingPreference: z.string().nullable().optional(),
    agreedOrderLine: z.string().nullable().optional(),
    guestReferenceKind: z
      .enum([
        "active_topic_price",
        "topic_switch",
        "clone_for_friend",
        "first_mentioned",
        "cheaper_variant",
        "last_denis_recommendation",
        "none",
      ])
      .nullable()
      .optional(),
    guestReferenceDetail: z.string().nullable().optional(),
  })
  .optional();

const aiResponseSchema = z.object({
  intent: z
    .enum([
      "recommend",
      "order",
      "clarify",
      "confirm",
      "status",
      "menu_info",
      "chat",
    ])
    .optional()
    .default("chat"),
  recommendations: z
    .array(
      z.object({
        productId: zUuid(),
        reason: z.string().trim().min(1).max(500),
      })
    )
    .max(AI_CONFIG.maxBrowseRecommendations)
    .optional()
    .default([]),
  proposedItems: z.array(proposedItemSchema).max(10).optional().default([]),
  quickReplies: z.array(z.string().trim().min(1).max(50)).max(6).optional().default([]),
  submitOrder: z.boolean().optional().default(false),
  message: z.string().trim().min(1).max(2000),
  turnInterpretation: turnInterpretationSchema,
  wantsMoreOptions: z.boolean().optional().default(false),
});

export type AiChatRecommendation = {
  productId: string;
  name: string;
  price: number;
  imageUrl: string | null;
  reason: string;
};

export function parseAiStructuredResponse(
  raw: string,
  productMap: Record<string, AiProductSummary>
): {
  structured: AiStructuredResponse;
  recommendations: AiChatRecommendation[];
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("invalid_ai_json");
  }

  const result = aiResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("invalid_ai_shape");
  }

  const recommendations = result.data.recommendations
    .map((item) => {
      const product = productMap[item.productId];
      if (!product) return null;
      return {
        productId: item.productId,
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl,
        reason: item.reason,
      };
    })
    .filter((item): item is AiChatRecommendation => item !== null);

  const structured: AiStructuredResponse = {
    intent: result.data.intent,
    recommendations: result.data.recommendations,
    proposedItems: result.data.proposedItems.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      modifierIds: item.modifierIds,
      serveSize: item.serveSize ?? null,
      notes: item.notes,
    })),
    quickReplies: result.data.quickReplies,
    submitOrder: result.data.submitOrder,
    message: result.data.message,
    wantsMoreOptions: result.data.wantsMoreOptions,
    ...(result.data.turnInterpretation
      ? {
          turnInterpretation: normalizeTurnInterpretation(
            result.data.turnInterpretation
          ),
        }
      : {}),
  };

  return { structured, recommendations };
}

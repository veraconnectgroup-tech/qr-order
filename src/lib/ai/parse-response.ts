import { z } from "zod";
import { AI_CONFIG } from "@/lib/ai/config";
import type { AiProductSummary, AiStructuredResponse } from "@/lib/ai/types";
import { zUuid } from "@/lib/security/zod-fields";

const proposedItemSchema = z.object({
  productId: zUuid(),
  quantity: z.number().int().min(1).max(10).optional().default(1),
  modifierIds: z.array(zUuid()).optional().default([]),
  serveSize: z.string().trim().max(20).nullable().optional(),
  notes: z.string().trim().max(200).optional().default(""),
});

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
    .max(AI_CONFIG.maxRecommendations)
    .optional()
    .default([]),
  proposedItems: z.array(proposedItemSchema).max(10).optional().default([]),
  quickReplies: z.array(z.string().trim().min(1).max(50)).max(6).optional().default([]),
  submitOrder: z.boolean().optional().default(false),
  message: z.string().trim().min(1).max(2000),
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
  };

  return { structured, recommendations };
}

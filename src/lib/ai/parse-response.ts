import { z } from "zod";
import { AI_CONFIG } from "@/lib/ai/config";
import type { AiProductSummary, AiStructuredResponse } from "@/lib/ai/types";
import { zUuid } from "@/lib/security/zod-fields";

const aiResponseSchema = z.object({
  recommendations: z
    .array(
      z.object({
        productId: zUuid(),
        reason: z.string().trim().min(1).max(500),
      })
    )
    .max(AI_CONFIG.maxRecommendations),
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

  return {
    structured: result.data,
    recommendations,
  };
}

import {
  aggregateProductFeedbackRatings,
  resolveDishRecommendationPolicy,
  type DishRecommendationPolicy,
} from "@/lib/denis/platform/feedback-intelligence";

export type ProductFeedbackKnowledge = {
  suppressProductIds: string[];
  promoteProductIds: string[];
  ratingsByProductId: Record<string, { avgRating: number; count: number }>;
};

/** Wire guest feedback into Denis dish knowledge — suppress poor, promote stars. */
export function buildProductFeedbackKnowledge(input: {
  feedbackRows: Array<{
    rating: number;
    productNames: string[];
  }>;
  productIdByName: Record<string, string>;
}): ProductFeedbackKnowledge {
  const flatRows = input.feedbackRows.flatMap((row) =>
    row.productNames.map((productName) => ({ rating: row.rating, productName }))
  );

  const byName = aggregateProductFeedbackRatings({ rows: flatRows });
  const ratingsByProductId: Record<string, { avgRating: number; count: number }> =
    {};
  const suppressProductIds: string[] = [];
  const promoteProductIds: string[] = [];

  for (const [name, stats] of Object.entries(byName)) {
    const productId = input.productIdByName[name.trim().toLowerCase()];
    if (!productId) continue;

    ratingsByProductId[productId] = stats;
    const policy = resolveDishRecommendationPolicy(stats.avgRating);
    if (policy === "suppress") suppressProductIds.push(productId);
    if (policy === "promote") promoteProductIds.push(productId);
  }

  return { suppressProductIds, promoteProductIds, ratingsByProductId };
}

export function feedbackPolicyForProduct(
  productId: string,
  knowledge: ProductFeedbackKnowledge | null
): DishRecommendationPolicy {
  if (!knowledge) return "neutral";
  if (knowledge.suppressProductIds.includes(productId)) return "suppress";
  if (knowledge.promoteProductIds.includes(productId)) return "promote";
  return "neutral";
}

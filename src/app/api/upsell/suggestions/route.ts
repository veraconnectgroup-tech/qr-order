import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { noCache } from "@/lib/cache/headers";
import { withRateLimit } from "@/lib/rate-limit";
import { zUuid } from "@/lib/security/zod-fields";
import {
  getSuggestions,
  resolveCartCategoryIds,
} from "@/lib/upsell/get-suggestions";

const querySchema = z.object({
  locationId: zUuid(),
  productIds: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean)
        : []
    )
    .pipe(z.array(zUuid())),
});

export async function GET(req: NextRequest) {
  const cacheHeaders = noCache();
  const limited = await withRateLimit(req, "orders");
  if (limited) return limited;

  const parsed = querySchema.safeParse({
    locationId: req.nextUrl.searchParams.get("locationId"),
    productIds: req.nextUrl.searchParams.get("productIds") ?? "",
  });

  if (!parsed.success) {
    return apiError("Invalid input.", 400, undefined, cacheHeaders);
  }

  const { locationId, productIds } = parsed.data;
  const categoryIds = await resolveCartCategoryIds(locationId, productIds);
  const suggestions = await getSuggestions(
    locationId,
    productIds,
    categoryIds
  );

  return apiSuccess({ suggestions }, 200, cacheHeaders);
}

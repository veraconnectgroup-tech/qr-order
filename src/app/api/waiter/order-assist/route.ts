import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getCachedMenuForLocation } from "@/lib/ai/menu-cache";
import { getCurrentStaff, getStaffLocationId } from "@/lib/auth/session";
import { noCache } from "@/lib/cache/headers";
import { buildWaiterOrderAssist } from "@/lib/denis/venue/copilot";
import { loadVenueKnowledgeGraph } from "@/lib/denis/kernel/vkg/load-graph";
import { withStaffRateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  query: z.string().max(120).default(""),
  cartProductIds: z.array(z.string().uuid()).max(20).default([]),
  knownAllergyLabels: z.array(z.string().max(40)).max(10).default([]),
  language: z.string().max(8).optional(),
});

export const POST = withErrorHandler(
  "waiter-order-assist-post",
  async (req, _ctx) => {
    const limited = await withStaffRateLimit(req);
    if (limited) return limited;

    const staff = await getCurrentStaff();
    if (!staff) {
      return apiError("Unauthorized.", 401, undefined, noCache());
    }

    const locationId = await getStaffLocationId(staff);
    if (!locationId) {
      return apiError("No location assigned.", 400, undefined, noCache());
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return apiError("Invalid request.", 400, parsed.error.flatten(), noCache());
    }

    const [menuCache, graph] = await Promise.all([
      getCachedMenuForLocation(locationId),
      loadVenueKnowledgeGraph(locationId).catch(() => null),
    ]);

    const catalog = Object.values(menuCache.catalog);
    const result = buildWaiterOrderAssist({
      query: parsed.data.query,
      catalog,
      graph,
      cartProductIds: parsed.data.cartProductIds,
      knownAllergyLabels: parsed.data.knownAllergyLabels,
      language: parsed.data.language,
    });

    return apiSuccess(result, 200, noCache());
  }
);

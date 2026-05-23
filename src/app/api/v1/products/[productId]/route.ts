import { z } from "zod";
import { NextRequest } from "next/server";
import { authenticateApiKey, requireScope } from "@/lib/api/v1/auth";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { apiError, apiSuccess } from "@/lib/api-response";
import { noCache } from "@/lib/cache/headers";
import { withRateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/security/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";

const patchSchema = z.object({
  is_available: z.boolean().optional(),
  price: z.number().positive().optional(),
});

export const PATCH = withErrorHandler(
  "v1-products-id-patch",
  async (req: NextRequest, ctx) => {
    const headers = noCache();
    const limited = await withRateLimit(req, "default");
    if (limited) return limited;

    const auth = await authenticateApiKey(req);
    if (auth instanceof Response) return auth;
    const scopeErr = requireScope(auth, "menu:write");
    if (scopeErr) return scopeErr;

    const { productId } = await ctx.params;
    if (!isUuid(productId)) {
      return apiError("Invalid product id.", 400, undefined, headers);
    }

    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return apiError("Invalid input.", 400, undefined, headers);

    const admin = createAdminClient();
    const { data: product } = await admin
      .from("products")
      .select("id, location_id")
      .eq("id", productId)
      .is("deleted_at", null)
      .maybeSingle();

    if (
      !product ||
      !auth.locationIds.includes((product as { location_id: string }).location_id)
    ) {
      return apiError("Not found.", 404, undefined, headers);
    }

    const { error } = await admin
      .from("products")
      .update(parsed.data as never)
      .eq("id", productId);

    if (error) return apiError(error.message, 500, undefined, headers);
    return apiSuccess({ ok: true }, 200, headers);
  }
);

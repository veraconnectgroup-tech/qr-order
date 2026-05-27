import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { runDenisLearnedEdgesAggregateTick } from "@/lib/admin/denis-learned-edges";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withErrorHandler(
  "cron-denis-learned-edges-get",
  async (req, _ctx) => {
    const secret = process.env.CRON_SECRET;
    const auth = req.headers.get("authorization");

    if (!secret || auth !== `Bearer ${secret}`) {
      return apiError("Unauthorized", 401);
    }

    const limitParam = req.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : 50;

    const admin = createAdminClient();
    const result = await runDenisLearnedEdgesAggregateTick(admin, {
      limit: Number.isFinite(limit) ? limit : 50,
    });

    logger.info("Denis learned edges aggregate completed", result);

    return apiSuccess(result);
  }
);

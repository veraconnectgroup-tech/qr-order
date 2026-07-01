import { apiError, apiSuccess } from "@/lib/api-response";
import { withCronRateLimit } from "@/lib/api-guard";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { processDenisFloorTick } from "@/lib/denis/venue/floor/process-floor-tick";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withErrorHandler("cron-denis-floor-get", async (req, _ctx) => {
  const limited = await withCronRateLimit(req);
  if (limited) return limited;

  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return apiError("Unauthorized", 401);
  }

  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : 50;

  const admin = createAdminClient();
  const result = await processDenisFloorTick(admin, {
    limit: Number.isFinite(limit) ? limit : 50,
  });

  logger.info("Denis floor tick completed", result);

  return apiSuccess(result);
});

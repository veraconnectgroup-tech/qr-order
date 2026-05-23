import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { runDailyAiIntelligence } from "@/lib/ai/intelligence-service";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

function yesterdayUtcDate() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export const GET = withErrorHandler("cron-ai-intelligence-get", async (req, _ctx) => {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return apiError("Unauthorized", 401);
  }

  const insightDate =
    req.nextUrl.searchParams.get("date")?.trim() || yesterdayUtcDate();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(insightDate)) {
    return apiError("Invalid date. Use YYYY-MM-DD.", 400);
  }

  const admin = createAdminClient();
  const result = await runDailyAiIntelligence(admin, insightDate);

  logger.info("AI intelligence cron completed", {
    insightDate,
    ...result,
  });

  return apiSuccess({
    insightDate,
    ...result,
  });
});

import { apiError, apiSuccess } from "@/lib/api-response";
import { withCronRateLimit } from "@/lib/api-guard";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { processDenisSchedulerTick } from "@/lib/denis/runtime/process-scheduler-tick";
import { checkAndCreateDueCommitmentMissions } from "@/lib/denis/stations/denis-commitments";
import { runDenisSelfSurveyTick } from "@/lib/denis/runtime/run-denis-self-survey";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export const GET = withErrorHandler("cron-denis-scheduler-get", async (req, _ctx) => {
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
  const result = await processDenisSchedulerTick(admin, {
    limit: Number.isFinite(limit) ? limit : 50,
  });

  // Denis's own follow-up on promises he made ("javicu sutra") — checked
  // every tick regardless of whether anyone calls him back.
  const commitments = await checkAndCreateDueCommitmentMissions(admin, {
    today: new Date().toISOString().slice(0, 10),
  });

  // Denis's own self-directed venue check — off per location until
  // ops.selfSurvey.enabled is flipped; each location's own cooldown
  // (Redis-backed) keeps this from re-asking the LLM every 5-minute tick.
  const selfSurvey = await runDenisSelfSurveyTick(admin);

  logger.info("Denis scheduler tick completed", {
    ...result,
    commitments,
    selfSurvey,
  });

  return apiSuccess({ ...result, commitments, selfSurvey });
});

export const maxDuration = 60;

import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { ensureOrgAiOpsQStashSchedule } from "@/lib/denis/commercial/ensure-org-ops-schedule";
import { refreshOrgAiOpsProjection } from "@/lib/denis/commercial/refresh-org-ops";
import { verifyQStashSignature } from "@/lib/queue/verify";
import { withRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

async function authorizeRefreshWorker(req: Request): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");

  if (cronSecret && auth === `Bearer ${cronSecret}`) {
    return true;
  }

  return verifyQStashSignature(req.clone());
}

/** ADR-009 F5 — refresh org_ai_ops read model (QStash / cron). */
export const POST = withErrorHandler(
  "jobs-refresh-org-ai-ops-post",
  async (req, _ctx) => {
    const limited = await withRateLimit(req, "jobs");
    if (limited) return limited;

    if (!(await authorizeRefreshWorker(req))) {
      return apiError("Unauthorized", 401);
    }

    ensureOrgAiOpsQStashSchedule();

    const admin = createAdminClient();
    const refreshed = await refreshOrgAiOpsProjection(admin);

    return apiSuccess({ refreshed });
  }
);

/** Vercel cron fallback — daily refresh when QStash is unavailable. */
export const GET = withErrorHandler(
  "jobs-refresh-org-ai-ops-get",
  async (req, _ctx) => {
    const cronSecret = process.env.CRON_SECRET;
    const auth = req.headers.get("authorization");

    if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
      return apiError("Unauthorized", 401);
    }

    ensureOrgAiOpsQStashSchedule();

    const admin = createAdminClient();
    const refreshed = await refreshOrgAiOpsProjection(admin);

    return apiSuccess({ refreshed });
  }
);

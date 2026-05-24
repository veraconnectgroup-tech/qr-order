export const maxDuration = 60;

import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { processOutboxBatch } from "@/lib/outbox/processor";
import { verifyQStashSignature } from "@/lib/queue/verify";
import { withRateLimit } from "@/lib/rate-limit";

async function authorizeOutboxWorker(req: Request): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");

  if (cronSecret && auth === `Bearer ${cronSecret}`) {
    return true;
  }

  return verifyQStashSignature(req.clone());
}

export const POST = withErrorHandler(
  "jobs-outbox-process-post",
  async (req, _ctx) => {
    const limited = await withRateLimit(req, "jobs");
    if (limited) return limited;

    if (!(await authorizeOutboxWorker(req))) {
      return apiError("Unauthorized", 401);
    }

    const result = await processOutboxBatch();

    return apiSuccess(result);
  }
);

/** Vercel cron fallback — same worker, Bearer CRON_SECRET. */
export const GET = withErrorHandler(
  "jobs-outbox-process-get",
  async (req, _ctx) => {
    const cronSecret = process.env.CRON_SECRET;
    const auth = req.headers.get("authorization");

    if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
      return apiError("Unauthorized", 401);
    }

    const result = await processOutboxBatch();
    return apiSuccess(result);
  }
);

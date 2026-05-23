import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { signOrderTransactionById } from "@/lib/fiscal/sign-transaction";
import { logger } from "@/lib/logger";
import { verifyQStashSignature } from "@/lib/queue/verify";
import { withRateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  orderId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const limited = await withRateLimit(req, "jobs");
    if (limited) return limited;

    const valid = await verifyQStashSignature(req.clone());
    if (!valid) {
      return apiError("Unauthorized", 401);
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return apiError("Invalid input.", 400);
    }

    await signOrderTransactionById(parsed.data.orderId);

    return apiSuccess({ ok: true });
  } catch (error) {
    logger.error("TSE sign job failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError("Job failed.", 500);
  }
}

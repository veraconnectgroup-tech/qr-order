export const maxDuration = 15;

import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { maybeSendOrderReceipt } from "@/lib/email/send-order-receipt";
import { verifyQStashSignature } from "@/lib/queue/verify";
import { withRateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  orderId: z.string().uuid(),
});

export const POST = withErrorHandler(
  "jobs-send-receipt-post",
  async (req, _ctx) => {
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

    await maybeSendOrderReceipt(parsed.data.orderId);

    return apiSuccess({ ok: true });
  }
);

export const maxDuration = 30;

import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import {
  cancelPreorderNoShow,
  releasePreorderKitchen,
} from "@/lib/denis/commerce/persist-preorder";
import { verifyQStashSignature } from "@/lib/queue/verify";
import { withRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  preorderId: z.string().uuid(),
  kind: z.enum(["release", "cancel_no_show"]),
});

/** QStash — kitchen release or no-show cancel for scheduled preorder (P3). */
export const POST = withErrorHandler("jobs-preorder-release-post", async (req) => {
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

  const admin = createAdminClient();
  const result =
    parsed.data.kind === "release"
      ? await releasePreorderKitchen(admin, parsed.data.preorderId)
      : await cancelPreorderNoShow(admin, parsed.data.preorderId);

  if (!result.ok) {
    return apiError(result.reason ?? "preorder_job_failed", 500);
  }

  return apiSuccess({ ok: true, reason: result.reason ?? null });
});

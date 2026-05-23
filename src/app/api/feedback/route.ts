import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { verifyOrderSessionAccess } from "@/lib/orders/validate-table-session";
import { sanitizeText } from "@/lib/security/sanitize";
import { zSessionToken, zUuid } from "@/lib/security/zod-fields";
import { logger } from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const postSchema = z.object({
  orderId: zUuid(),
  sessionToken: zSessionToken(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export const GET = withErrorHandler("feedback-get", async (req, _ctx) => {
  const limited = await withRateLimit(req, "feedback");
  if (limited) return limited;

  const orderId = req.nextUrl.searchParams.get("orderId");
  const sessionToken = req.nextUrl.searchParams.get("sessionToken");

  const orderParsed = zUuid().safeParse(orderId ?? "");
  const sessionParsed = zSessionToken().safeParse(sessionToken ?? "");
  if (!orderParsed.success || !sessionParsed.success) {
    return apiError("Invalid input.", 400);
  }

  const admin = createAdminClient();
  const allowed = await verifyOrderSessionAccess(
    admin,
    orderParsed.data,
    sessionParsed.data
  );
  if (!allowed) {
    return apiError("Unauthorized.", 401);
  }

  const { data: feedback } = await admin
    .from("order_feedback")
    .select("id, rating, comment, created_at")
    .eq("order_id", orderParsed.data)
    .maybeSingle();

  return apiSuccess({
    submitted: !!feedback,
    feedback: feedback ?? null,
  });
});

export const POST = withErrorHandler(
  "feedback-post",
  async (req, _ctx) => {
    const limited = await withRateLimit(req, "feedback");
    if (limited) return limited;

    const body = await req.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid input.", 400);
    }

    const { orderId, sessionToken, rating, comment } = parsed.data;
    const admin = createAdminClient();

    const allowed = await verifyOrderSessionAccess(
      admin,
      orderId,
      sessionToken
    );
    if (!allowed) {
      return apiError("Unauthorized.", 401);
    }

    const { data: order } = await admin
      .from("orders")
      .select("id, status, location_id")
      .eq("id", orderId)
      .single();

    if (!order) {
      return apiError("Order not found.", 404);
    }

    const orderRow = order as {
      id: string;
      status: string;
      location_id: string;
    };

    if (orderRow.status !== "delivered") {
      return apiError("Feedback is only available after delivery.", 400);
    }

    const { data: existing } = await admin
      .from("order_feedback")
      .select("id")
      .eq("order_id", orderId)
      .maybeSingle();

    if (existing) {
      return apiError("Feedback already submitted.", 409);
    }

    const sanitizedComment = comment?.trim()
      ? sanitizeText(comment.trim(), 500)
      : null;

    const { data: inserted, error } = await admin
      .from("order_feedback")
      .insert({
        order_id: orderId,
        location_id: orderRow.location_id,
        rating,
        comment: sanitizedComment,
      })
      .select("id, rating, comment, created_at")
      .single();

    if (error) {
      logger.error("Feedback insert error", { error: error.message });
      return apiError("Could not save feedback.", 500);
    }

    return apiSuccess({ feedback: inserted });
  }
);

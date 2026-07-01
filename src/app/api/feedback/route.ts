import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { submitSessionFeedback } from "@/lib/commerce/capabilities/feedback-v2/submit-session-feedback";
import {
  type FeedbackCategory,
} from "@/lib/commerce/experience/resolve-experience-moment";
import { analyzeFeedbackComment, resolveFeedbackPostSubmit } from "@/lib/denis/platform/feedback-intelligence";
import { verifyOrderSessionAccess } from "@/lib/orders/validate-table-session";
import { getCurrentTraceId } from "@/lib/resilience/trace.server";
import { sanitizeText } from "@/lib/security/sanitize";
import { zSessionToken, zUuid } from "@/lib/security/zod-fields";
import { logger } from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const sentimentSchema = z.enum(["positive", "neutral", "negative"]);
const categorySchema = z.enum(["food", "service", "wait_time", "other"]);

const postSchema = z.object({
  orderId: zUuid(),
  sessionToken: zSessionToken(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
  sentiment: sentimentSchema.optional(),
  category: categorySchema.optional(),
});

async function resolveSessionId(
  admin: ReturnType<typeof createAdminClient>,
  orderId: string,
  sessionToken: string
): Promise<string | null> {
  const { data: order } = await admin
    .from("orders")
    .select("session_id")
    .eq("id", orderId)
    .maybeSingle();

  const sessionId = (order as { session_id: string | null } | null)?.session_id;
  if (!sessionId) return null;

  const allowed = await verifyOrderSessionAccess(admin, orderId, sessionToken);
  if (!allowed) return null;

  return sessionId;
}

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
  const sessionId = await resolveSessionId(
    admin,
    orderParsed.data,
    sessionParsed.data
  );
  if (!sessionId) {
    return apiError("Unauthorized.", 401);
  }

  const { data: feedbackByOrder } = await admin
    .from("order_feedback")
    .select(
      "id, rating, comment, sentiment, category, created_at, session_id"
    )
    .eq("order_id", orderParsed.data)
    .maybeSingle();

  if (feedbackByOrder) {
    return apiSuccess({
      submitted: true,
      feedback: feedbackByOrder,
    });
  }

  const { data: feedbackBySession } = await admin
    .from("order_feedback")
    .select(
      "id, rating, comment, sentiment, category, created_at, session_id"
    )
    .eq("session_id", sessionId)
    .maybeSingle();

  return apiSuccess({
    submitted: !!feedbackBySession,
    feedback: feedbackBySession ?? null,
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

    const { orderId, sessionToken, rating, comment, sentiment, category } =
      parsed.data;
    const admin = createAdminClient();

    const sessionId = await resolveSessionId(admin, orderId, sessionToken);
    if (!sessionId) {
      return apiError("Unauthorized.", 401);
    }

    const sanitizedComment = comment?.trim()
      ? sanitizeText(comment.trim(), 500)
      : null;

    const analysis = analyzeFeedbackComment({
      rating,
      comment: sanitizedComment,
      sentiment: sentiment ?? undefined,
    });

    const result = await submitSessionFeedback(admin, {
      orderId,
      sessionId,
      rating,
      comment: sanitizedComment,
      sentiment: analysis.sentiment,
      category: category ?? analysis.category,
      traceId: getCurrentTraceId() ?? undefined,
    });

    if (!result.ok) {
      if (result.code === "already_submitted") {
        return apiError("Feedback already submitted.", 409);
      }
      if (result.code === "not_eligible") {
        return apiError("Feedback is not available yet.", 400);
      }
      if (result.code === "order_not_found") {
        return apiError("Order not found.", 404);
      }
      logger.error("Feedback commerce submit failed", {
        orderId,
        sessionId,
        code: result.code,
      });
      return apiError("Could not save feedback.", 500);
    }

    const { data: feedback } = await admin
      .from("order_feedback")
      .select("id, rating, comment, sentiment, category, created_at")
      .eq("session_id", sessionId)
      .maybeSingle();

    return apiSuccess({
      feedback,
      eventId: result.eventId,
      analysis: analyzeFeedbackComment({
        rating,
        comment: sanitizedComment,
        sentiment: feedback?.sentiment as
          | "positive"
          | "neutral"
          | "negative"
          | undefined,
      }),
      postSubmit: resolveFeedbackPostSubmit({
        rating,
        sentiment: analysis.sentiment,
      }),
    });
  }
);

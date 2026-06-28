import { createHmac, timingSafeEqual } from "crypto";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { logger } from "@/lib/logger";
import { handleDeliverectWebhook } from "@/lib/pos/deliverect-webhook";
import { withRateLimit } from "@/lib/rate-limit";

function verifyDeliverectSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  const hmac = createHmac("sha256", secret).update(body).digest("hex");

  try {
    const expected = Buffer.from(hmac, "utf8");
    const received = Buffer.from(signature, "utf8");
    if (expected.length !== received.length) return false;
    return timingSafeEqual(expected, received);
  } catch {
    return hmac === signature;
  }
}

export const POST = withErrorHandler(
  "deliverect-webhook-post",
  async (req) => {
  const limited = await withRateLimit(req, "default");
  if (limited) return limited;

    const body = await req.text();
    const signature =
      req.headers.get("x-deliverect-signature") ??
      req.headers.get("x-deliverect-hmac-sha256");
    const secret = process.env.DELIVERECT_WEBHOOK_SECRET;

    if (!secret) {
      logger.error("Deliverect webhook rejected — secret not configured");
      return new Response("Unauthorized", { status: 401 });
    }

    if (!signature) {
      logger.warn("Deliverect webhook rejected — missing signature header");
      return new Response("Unauthorized", { status: 401 });
    }

    if (!verifyDeliverectSignature(body, signature, secret)) {
      logger.warn("Deliverect webhook rejected — invalid signature");
      return new Response("Unauthorized", { status: 401 });
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(body) as Record<string, unknown>;
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const result = await handleDeliverectWebhook(parsed);

    if (!result.ok) {
      return new Response(result.message, { status: 400 });
    }

    return new Response("OK", { status: 200 });
  }
);

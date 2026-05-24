import { createHmac } from "crypto";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { logger } from "@/lib/logger";
import { handleDeliverectWebhook } from "@/lib/pos/deliverect-webhook";

export const POST = withErrorHandler(
  "deliverect-webhook-post",
  async (req) => {
    const body = await req.text();
    const signature = req.headers.get("x-deliverect-hmac-sha256");
    const secret = process.env.DELIVERECT_WEBHOOK_SECRET;

    if (!secret) {
      logger.warn("Deliverect webhook received without HMAC verification");
    } else if (signature) {
      const hmac = createHmac("sha256", secret).update(body).digest("hex");
      if (hmac !== signature) {
        logger.warn("Deliverect webhook bad signature");
        return new Response("Invalid signature", { status: 401 });
      }
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

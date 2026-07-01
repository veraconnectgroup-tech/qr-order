import { headers } from "next/headers";
import Stripe from "stripe";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { logger } from "@/lib/logger";
import { getStripe } from "@/lib/stripe/client";
import { handleStripeWebhookEvent } from "@/lib/stripe/webhook";
import { withRateLimit } from "@/lib/rate-limit";

export const POST = withErrorHandler(
  "stripe-webhook-post",
  async (req, _ctx) => {
  const limited = await withRateLimit(req, "default");
  if (limited) return limited;

    const body = await req.text();
    const signature = (await headers()).get("stripe-signature");
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
      return new Response("Missing signature", { status: 400 });
    }

    let event: Stripe.Event;

    try {
      const stripe = getStripe();
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (error) {
      logger.error("Webhook signature verification failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return new Response("Invalid signature", { status: 400 });
    }

    try {
      await handleStripeWebhookEvent(event);
      logger.info("Stripe webhook processed", {
        eventId: event.id,
        eventType: event.type,
      });
      return new Response("OK", { status: 200 });
    } catch (error) {
      logger.error("Stripe webhook processing failed", {
        eventId: event.id,
        eventType: event.type,
        error: error instanceof Error ? error.message : String(error),
      });
      return new Response("Webhook handler failed", { status: 500 });
    }
  }
);

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getStripe } from "@/lib/stripe/client";
import { handleStripeWebhookEvent } from "@/lib/stripe/webhook";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return new Response("Missing signature", { status: 400 });
  }

  try {
    const stripe = getStripe();
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );

    await handleStripeWebhookEvent(event);
    return new Response("OK", { status: 200 });
  } catch (error) {
    logger.error("Webhook signature verification failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return new Response("Invalid signature", { status: 400 });
  }
}

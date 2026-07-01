import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it in Vercel → Settings → Environment Variables."
    );
  }

  if (!stripeInstance) {
    // Cast needed: @stripe/terminal-js's nested stripe@8 types can win module
    // resolution for this import, and its LatestApiVersion literal differs
    // from the runtime stripe@22 package.
    stripeInstance = new Stripe(key, {
      apiVersion: "2026-04-22.dahlia" as unknown as Stripe.LatestApiVersion,
    });
  }
  return stripeInstance;
}

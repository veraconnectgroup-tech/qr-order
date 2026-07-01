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
    // resolution for this import, and its apiVersion literal type differs
    // from the runtime stripe@22 package. `as never` satisfies both without
    // referencing version-specific type members like LatestApiVersion.
    stripeInstance = new Stripe(key, {
      apiVersion: "2026-04-22.dahlia" as never,
    });
  }
  return stripeInstance;
}

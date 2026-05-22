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
    stripeInstance = new Stripe(key);
  }
  return stripeInstance;
}

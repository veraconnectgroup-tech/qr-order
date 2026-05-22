import Stripe from "stripe";
import { getServerAppUrl } from "@/lib/app-url";
import { getStripe } from "./client";

function connectUrls(appUrl: string) {
  const base = appUrl.replace(/\/$/, "");
  return {
    refresh: `${base}/dashboard/settings?stripe=refresh`,
    return: `${base}/dashboard/settings?stripe=complete`,
  };
}

export function stripeConnectErrorMessage(error: unknown): string {
  if (error instanceof Stripe.errors.StripeError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown Stripe error";
}

export function assertStripeConnectConfig() {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it in Vercel → Settings → Environment Variables."
    );
  }

  const appUrl = getServerAppUrl();
  if (!appUrl.startsWith("http")) {
    throw new Error(
      "App URL is not configured. Set NEXT_PUBLIC_APP_URL on Vercel and redeploy."
    );
  }

  return appUrl;
}

export function isStripePlatformConfigured() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY?.trim() &&
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()
  );
}

export async function syncStripeConnectStatus(
  orgId: string,
  accountId: string
) {
  const stripe = getStripe();
  const account = await stripe.accounts.retrieve(accountId);
  const onboarded = Boolean(account.charges_enabled && account.payouts_enabled);

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  await admin
    .from("organizations")
    .update({ stripe_onboarded: onboarded })
    .eq("id", orgId)
    .eq("stripe_account_id", accountId);

  return { onboarded, account };
}

async function createOnboardingLink(accountId: string, appUrl: string) {
  const stripe = getStripe();
  const urls = connectUrls(appUrl);

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: urls.refresh,
    return_url: urls.return,
    type: "account_onboarding",
  });

  if (!accountLink.url) {
    throw new Error("Stripe did not return an onboarding URL.");
  }

  return accountLink.url;
}

async function createExpressAccount(orgId: string, orgEmail: string | null) {
  const stripe = getStripe();

  const account = await stripe.accounts.create({
    type: "express",
    country: "DE",
    email: orgEmail ?? undefined,
    metadata: { org_id: orgId },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });

  return account.id;
}

export async function createConnectAccountLink(
  orgId: string,
  orgEmail: string | null,
  existingAccountId: string | null
) {
  const appUrl = assertStripeConnectConfig();
  const stripe = getStripe();

  let accountId = existingAccountId;

  if (accountId) {
    const account = await stripe.accounts.retrieve(accountId);
    if (account.type !== "express") {
      accountId = await createExpressAccount(orgId, orgEmail);
    }
  } else {
    accountId = await createExpressAccount(orgId, orgEmail);
  }

  const url = await createOnboardingLink(accountId, appUrl);

  return { accountId, url };
}

export function calcPlatformFee(total: number, feePercent: number) {
  return Math.round(total * (feePercent / 100) * 100);
}

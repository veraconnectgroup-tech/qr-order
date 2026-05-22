import { getStripe } from "./client";

export async function createConnectAccountLink(orgId: string, orgEmail: string | null) {
  const stripe = getStripe();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  const account = await stripe.accounts.create({
    type: "standard",
    country: "DE",
    email: orgEmail ?? undefined,
    metadata: { org_id: orgId },
  });

  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${appUrl}/dashboard/settings?stripe=refresh`,
    return_url: `${appUrl}/dashboard/settings?stripe=complete`,
    type: "account_onboarding",
  });

  return { accountId: account.id, url: accountLink.url };
}

export function calcPlatformFee(total: number, feePercent: number) {
  return Math.round(total * (feePercent / 100) * 100);
}

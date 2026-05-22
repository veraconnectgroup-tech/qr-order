import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createConnectAccountLink } from "@/lib/stripe/connect";

export async function POST() {
  try {
    const staff = await getCurrentStaff();
    if (!staff || !["owner", "manager"].includes(staff.role)) {
      return NextResponse.json({ error: "Neautorizovano." }, { status: 401 });
    }
    const admin = createAdminClient();

    const { data: org } = await admin
      .from("organizations")
      .select("id, email, stripe_account_id")
      .eq("id", staff.org_id)
      .single();

    if (!org) {
      return NextResponse.json({ error: "Organizacija nije pronađena." }, { status: 404 });
    }

    const orgRow = org as {
      id: string;
      email: string | null;
      stripe_account_id: string | null;
    };

    if (orgRow.stripe_account_id) {
      const { getStripe } = await import("@/lib/stripe/client");
      const stripe = getStripe();
      const accountLink = await stripe.accountLinks.create({
        account: orgRow.stripe_account_id,
        refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?stripe=refresh`,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?stripe=complete`,
        type: "account_onboarding",
      });
      return NextResponse.json({ data: { url: accountLink.url } });
    }

    const { accountId, url } = await createConnectAccountLink(
      orgRow.id,
      orgRow.email
    );

    await admin
      .from("organizations")
      .update({ stripe_account_id: accountId })
      .eq("id", orgRow.id);

    return NextResponse.json({ data: { url } });
  } catch (error) {
    console.error("Stripe connect error:", error);
    return NextResponse.json(
      { error: "Stripe povezivanje nije uspelo." },
      { status: 500 }
    );
  }
}

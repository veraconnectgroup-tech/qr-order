import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertStripeConnectConfig,
  createConnectAccountLink,
  stripeConnectErrorMessage,
  syncStripeConnectStatus,
} from "@/lib/stripe/connect";

async function requireConnectStaff() {
  const staff = await getCurrentStaff();
  if (!staff || !["owner", "manager"].includes(staff.role)) {
    return null;
  }
  return staff;
}

export async function GET() {
  try {
    const staff = await requireConnectStaff();
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    assertStripeConnectConfig();

    const admin = createAdminClient();
    const { data: org } = await admin
      .from("organizations")
      .select("id, stripe_account_id, stripe_onboarded")
      .eq("id", staff.org_id)
      .single();

    const orgRow = org as {
      id: string;
      stripe_account_id: string | null;
      stripe_onboarded: boolean;
    } | null;

    if (!orgRow?.stripe_account_id) {
      return NextResponse.json({
        data: { onboarded: false, hasAccount: false },
      });
    }

    const { onboarded } = await syncStripeConnectStatus(
      orgRow.id,
      orgRow.stripe_account_id
    );

    return NextResponse.json({
      data: {
        onboarded,
        hasAccount: true,
        accountId: orgRow.stripe_account_id,
      },
    });
  } catch (error) {
    console.error("Stripe connect sync error:", error);
    return NextResponse.json(
      { error: stripeConnectErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const staff = await requireConnectStaff();
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    assertStripeConnectConfig();

    const admin = createAdminClient();
    const { data: org } = await admin
      .from("organizations")
      .select("id, email, stripe_account_id")
      .eq("id", staff.org_id)
      .single();

    if (!org) {
      return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    }

    const orgRow = org as {
      id: string;
      email: string | null;
      stripe_account_id: string | null;
    };

    const { accountId, url } = await createConnectAccountLink(
      orgRow.id,
      orgRow.email,
      orgRow.stripe_account_id
    );

    if (accountId !== orgRow.stripe_account_id) {
      await admin
        .from("organizations")
        .update({
          stripe_account_id: accountId,
          stripe_onboarded: false,
        })
        .eq("id", orgRow.id);
    }

    return NextResponse.json({ data: { url } });
  } catch (error) {
    console.error("Stripe connect error:", error);
    const message = stripeConnectErrorMessage(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

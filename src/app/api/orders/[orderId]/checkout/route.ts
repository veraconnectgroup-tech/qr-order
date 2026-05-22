import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { PaymentMethod } from "@/lib/constants";
import { verifyOrderSessionAccess } from "@/lib/orders/validate-table-session";
import { getAvailablePaymentMethods } from "@/lib/payment-methods";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { calcPlatformFee } from "@/lib/stripe/connect";

const schema = z.object({
  sessionToken: z.string().min(1),
  paymentMethod: z.enum(["online", "at_bar", "card_at_table"]),
});

async function loadPaymentOptions(locationId: string) {
  const admin = createAdminClient();
  const { data: location } = await admin
    .from("locations")
    .select(
      "payment_online_enabled, payment_at_bar_enabled, payment_card_at_table_enabled, org_id"
    )
    .eq("id", locationId)
    .single();

  if (!location) return null;

  const loc = location as {
    payment_online_enabled: boolean;
    payment_at_bar_enabled: boolean;
    payment_card_at_table_enabled: boolean;
    org_id: string;
  };

  const { data: org } = await admin
    .from("organizations")
    .select("stripe_onboarded")
    .eq("id", loc.org_id)
    .single();

  return getAvailablePaymentMethods({
    stripeOnboarded: Boolean((org as { stripe_onboarded: boolean } | null)?.stripe_onboarded),
    stripePublishableKey: Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    paymentOnlineEnabled: loc.payment_online_enabled,
    paymentAtBarEnabled: loc.payment_at_bar_enabled,
    paymentCardAtTableEnabled: loc.payment_card_at_table_enabled,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { sessionToken, paymentMethod } = parsed.data;

    const allowed = await verifyOrderSessionAccess(
      admin,
      orderId,
      sessionToken
    );
    if (!allowed) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { data: order } = await admin
      .from("orders")
      .select(
        "id, total, payment_status, payment_method, stripe_payment_intent_id, location_id, status"
      )
      .eq("id", orderId)
      .single();

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const orderRow = order as {
      id: string;
      total: number;
      payment_status: string;
      payment_method: string;
      stripe_payment_intent_id: string | null;
      location_id: string;
      status: string;
    };

    if (orderRow.payment_status === "paid") {
      return NextResponse.json({ error: "Already paid." }, { status: 400 });
    }

    if (orderRow.status === "rejected" || orderRow.status === "cancelled") {
      return NextResponse.json({ error: "Order is closed." }, { status: 400 });
    }

    const methods = await loadPaymentOptions(orderRow.location_id);
    if (!methods?.includes(paymentMethod as PaymentMethod)) {
      return NextResponse.json(
        { error: "This payment method is not available." },
        { status: 400 }
      );
    }

    await admin
      .from("orders")
      .update({ payment_method: paymentMethod })
      .eq("id", orderId);

    if (paymentMethod !== "online") {
      return NextResponse.json({
        data: { ok: true, paymentMethod },
      });
    }

    if (orderRow.stripe_payment_intent_id) {
      const stripe = getStripe();
      const existing = await stripe.paymentIntents.retrieve(
        orderRow.stripe_payment_intent_id
      );
      if (existing.client_secret) {
        const { data: location } = await admin
          .from("locations")
          .select("org_id")
          .eq("id", orderRow.location_id)
          .single();
        const { data: orgData } = await admin
          .from("organizations")
          .select("stripe_account_id")
          .eq("id", (location as { org_id: string }).org_id)
          .single();

        return NextResponse.json({
          data: {
            clientSecret: existing.client_secret,
            stripeAccountId: (orgData as { stripe_account_id: string })
              .stripe_account_id,
          },
        });
      }
    }

    const { data: location } = await admin
      .from("locations")
      .select("org_id")
      .eq("id", orderRow.location_id)
      .single();

    const { data: orgData } = await admin
      .from("organizations")
      .select(
        "stripe_account_id, platform_fee_percent, platform_fee_fixed, currency, stripe_onboarded"
      )
      .eq("id", (location as { org_id: string }).org_id)
      .single();

    const org = orgData as {
      stripe_account_id: string | null;
      platform_fee_percent: number;
      platform_fee_fixed: number;
      currency: string;
      stripe_onboarded: boolean;
    };

    if (!org.stripe_onboarded || !org.stripe_account_id) {
      return NextResponse.json(
        { error: "Online payments are not available." },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const amountCents = Math.round(Number(orderRow.total) * 100);
    const applicationFee = calcPlatformFee(Number(orderRow.total), {
      feePercent: org.platform_fee_percent,
      feeFixed: org.platform_fee_fixed,
    });

    const intent = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency: (org.currency ?? "eur").toLowerCase(),
        automatic_payment_methods: { enabled: true },
        application_fee_amount: applicationFee,
        metadata: { order_id: orderId },
      },
      { stripeAccount: org.stripe_account_id }
    );

    await admin
      .from("orders")
      .update({
        stripe_payment_intent_id: intent.id,
        payment_status: "processing",
      })
      .eq("id", orderId);

    if (!intent.client_secret) {
      return NextResponse.json(
        { error: "Payment could not be started." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: {
        clientSecret: intent.client_secret,
        stripeAccountId: org.stripe_account_id,
      },
    });
  } catch (error) {
    console.error("Order checkout error:", error);
    return NextResponse.json(
      { error: "Payment could not be started." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyOrderSessionAccess } from "@/lib/orders/validate-table-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { calcPlatformFee } from "@/lib/stripe/connect";

const schema = z.object({
  orderId: z.string().uuid(),
  sessionToken: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { orderId, sessionToken } = parsed.data;

    const hasAccess = await verifyOrderSessionAccess(
      admin,
      orderId,
      sessionToken
    );

    if (!hasAccess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: order } = await admin
      .from("orders")
      .select(
        "id, total, payment_status, payment_method, stripe_payment_intent_id, location_id, status"
      )
      .eq("id", orderId)
      .single();

    if (!order) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
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

    if (orderRow.payment_method !== "online") {
      return NextResponse.json(
        { error: "This order uses an in-venue payment method." },
        { status: 400 }
      );
    }

    if (orderRow.status === "rejected" || orderRow.status === "cancelled") {
      return NextResponse.json(
        { error: "Order is no longer payable." },
        { status: 400 }
      );
    }

    const { data: location } = await admin
      .from("locations")
      .select("org_id")
      .eq("id", orderRow.location_id)
      .single();

    if (!location) {
      return NextResponse.json({ error: "Location not found." }, { status: 404 });
    }

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
    } | null;

    if (!org?.stripe_onboarded || !org.stripe_account_id) {
      return NextResponse.json(
        { error: "Payments are not configured for this venue." },
        { status: 400 }
      );
    }

    if (orderRow.payment_status === "paid") {
      return NextResponse.json({ error: "Already paid." }, { status: 400 });
    }

    const stripe = getStripe();

    if (orderRow.stripe_payment_intent_id) {
      const existing = await stripe.paymentIntents.retrieve(
        orderRow.stripe_payment_intent_id
      );
      const amountCents = Math.round(Number(orderRow.total) * 100);
      const platformFee = calcPlatformFee(Number(orderRow.total), {
        feePercent: org.platform_fee_percent,
        feeFixed: org.platform_fee_fixed,
      });

      if (existing.amount !== amountCents) {
        await stripe.paymentIntents.update(orderRow.stripe_payment_intent_id, {
          amount: amountCents,
          application_fee_amount: platformFee,
        });
      }

      if (existing.client_secret) {
        return NextResponse.json({
          data: {
            clientSecret: existing.client_secret,
            stripeAccountId: org.stripe_account_id,
          },
        });
      }
    }

    const platformFee = calcPlatformFee(Number(orderRow.total), {
      feePercent: org.platform_fee_percent,
      feeFixed: org.platform_fee_fixed,
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(orderRow.total) * 100),
      currency: org.currency.toLowerCase(),
      application_fee_amount: platformFee,
      transfer_data: { destination: org.stripe_account_id },
      metadata: {
        order_id: orderRow.id,
        location_id: orderRow.location_id,
      },
      automatic_payment_methods: { enabled: true },
    });

    await admin
      .from("orders")
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        payment_status: "processing",
      })
      .eq("id", orderRow.id);

    return NextResponse.json({
      data: {
        clientSecret: paymentIntent.client_secret,
        stripeAccountId: org.stripe_account_id,
      },
    });
  } catch (error) {
    console.error("Payment intent error:", error);
    return NextResponse.json(
      { error: "Payment could not be started." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateTableSession } from "@/lib/orders/validate-table-session";
import { withRateLimitScope } from "@/lib/rate-limit";
import {
  getAvailablePaymentMethods,
  type SelectablePaymentMethod,
} from "@/lib/payment-methods";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { calcPlatformFee } from "@/lib/stripe/connect";

export async function GET(req: NextRequest) {
  const limited = await withRateLimitScope(req, "sessions");
  if (limited) return limited;

  const sessionToken = req.nextUrl.searchParams.get("sessionToken");
  if (!sessionToken) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const tableToken = req.nextUrl.searchParams.get("tableToken");
  if (!tableToken) {
    return NextResponse.json({ error: "Invalid table." }, { status: 400 });
  }

  const admin = createAdminClient();
  const sessionResult = await validateTableSession(
    admin,
    tableToken,
    sessionToken
  );

  if ("error" in sessionResult) {
    return NextResponse.json(
      { error: sessionResult.error },
      { status: sessionResult.status }
    );
  }

  const { session } = sessionResult.data;

  const { data: orders } = await admin
    .from("orders")
    .select(
      "id, order_number, status, payment_status, payment_method, subtotal, tax_amount, total, created_at"
    )
    .eq("session_id", session.id)
    .not("status", "in", '("rejected","cancelled")')
    .order("created_at", { ascending: true });

  const rows =
    (orders as Array<{
      id: string;
      order_number: number;
      status: string;
      payment_status: string;
      payment_method: string;
      subtotal: number;
      tax_amount: number;
      total: number;
      created_at: string;
    }>) ?? [];

  const unpaid = rows.filter((o) => o.payment_status !== "paid");
  const amountDue = unpaid.reduce((sum, o) => sum + Number(o.total), 0);
  const subtotal = unpaid.reduce((sum, o) => sum + Number(o.subtotal), 0);
  const taxAmount = unpaid.reduce((sum, o) => sum + Number(o.tax_amount), 0);

  return NextResponse.json({
    data: {
      orders: rows,
      unpaidOrderIds: unpaid.map((o) => o.id),
      amountDue,
      subtotal,
      taxAmount,
      orderCount: rows.length,
      unpaidCount: unpaid.length,
    },
  });
}

const checkoutSchema = z.object({
  sessionToken: z.string().min(1),
  tableToken: z.string().min(1),
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
    stripeOnboarded: Boolean(
      (org as { stripe_onboarded: boolean } | null)?.stripe_onboarded
    ),
    stripePublishableKey: Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    paymentOnlineEnabled: loc.payment_online_enabled,
    paymentAtBarEnabled: loc.payment_at_bar_enabled,
    paymentCardAtTableEnabled: loc.payment_card_at_table_enabled,
  });
}

export async function POST(req: NextRequest) {
  const limited = await withRateLimitScope(req, "sessions");
  if (limited) return limited;

  const body = await req.json();
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { sessionToken, tableToken, paymentMethod } = parsed.data;

  const sessionResult = await validateTableSession(
    admin,
    tableToken,
    sessionToken
  );

  if ("error" in sessionResult) {
    return NextResponse.json(
      { error: sessionResult.error },
      { status: sessionResult.status }
    );
  }

  const { session } = sessionResult.data;

  const { data: orders } = await admin
    .from("orders")
    .select("id, total, location_id, stripe_payment_intent_id, payment_status")
    .eq("session_id", session.id)
    .neq("payment_status", "paid")
    .not("status", "in", '("rejected","cancelled")');

  const unpaidOrders =
    (orders as Array<{
      id: string;
      total: number;
      location_id: string;
      stripe_payment_intent_id: string | null;
      payment_status: string;
    }>) ?? [];

  if (unpaidOrders.length === 0) {
    return NextResponse.json({ error: "Nothing to pay." }, { status: 400 });
  }

  const locationId = unpaidOrders[0].location_id;
  const methods = await loadPaymentOptions(locationId);
  if (!methods?.includes(paymentMethod as SelectablePaymentMethod)) {
    return NextResponse.json(
      { error: "This payment method is not available." },
      { status: 400 }
    );
  }

  const orderIds = unpaidOrders.map((o) => o.id);
  const sessionTotal = unpaidOrders.reduce(
    (sum, o) => sum + Number(o.total),
    0
  );

  if (paymentMethod !== "online") {
    const now = new Date().toISOString();
    const { error } = await admin
      .from("orders")
      .update({
        payment_method: paymentMethod,
        payment_requested_at: now,
      })
      .in("id", orderIds);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        ok: true,
        orderIds,
        paymentMethod,
      },
    });
  }

  const existingPiId = unpaidOrders.find(
    (o) => o.stripe_payment_intent_id
  )?.stripe_payment_intent_id;

  const { data: location } = await admin
    .from("locations")
    .select("org_id")
    .eq("id", locationId)
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

  if (existingPiId) {
    const existing = await stripe.paymentIntents.retrieve(
      existingPiId,
      {},
      { stripeAccount: org.stripe_account_id }
    );
    if (existing.client_secret) {
      await admin
        .from("orders")
        .update({
          payment_method: "online",
          payment_requested_at: new Date().toISOString(),
        })
        .in("id", orderIds);

      return NextResponse.json({
        data: {
          clientSecret: existing.client_secret,
          stripeAccountId: org.stripe_account_id,
          orderIds,
        },
      });
    }
  }

  const amountCents = Math.round(sessionTotal * 100);
  const applicationFee = calcPlatformFee(sessionTotal, {
    feePercent: org.platform_fee_percent,
    feeFixed: org.platform_fee_fixed,
  });

  const intent = await stripe.paymentIntents.create(
    {
      amount: amountCents,
      currency: (org.currency ?? "eur").toLowerCase(),
      automatic_payment_methods: { enabled: true },
      application_fee_amount: applicationFee,
      metadata: {
        order_id: orderIds[0],
        order_ids: orderIds.join(","),
        session_id: session.id,
      },
    },
    { stripeAccount: org.stripe_account_id }
  );

  if (!intent.client_secret) {
    return NextResponse.json(
      { error: "Payment could not be started." },
      { status: 500 }
    );
  }

  await admin
    .from("orders")
    .update({
      payment_method: "online",
      payment_status: "processing",
      stripe_payment_intent_id: intent.id,
      payment_requested_at: new Date().toISOString(),
    })
    .in("id", orderIds);

  return NextResponse.json({
    data: {
      clientSecret: intent.client_secret,
      stripeAccountId: org.stripe_account_id,
      orderIds,
    },
  });
}

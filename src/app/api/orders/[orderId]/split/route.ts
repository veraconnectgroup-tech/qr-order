import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { noCache } from "@/lib/cache/headers";
import { logger } from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/security/sanitize";
import { zSessionToken, zTableToken } from "@/lib/security/zod-fields";
import {
  collectAssignedItemIds,
  MAX_SPLIT_PARTS,
  MIN_SPLIT_PARTS,
  proportionalTip,
  roundMoney,
  splitAmountEqually,
  sumSplitAmounts,
  type SplitPaymentRow,
} from "@/lib/orders/split-payments";
import { verifyTableOrderAccess } from "@/lib/orders/validate-table-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { calcPlatformFee } from "@/lib/stripe/connect";

const querySchema = z.object({
  sessionToken: zSessionToken(),
  tableToken: zTableToken(),
});

const equalSplitSchema = z.object({
  mode: z.literal("equal"),
  parts: z.number().int().min(MIN_SPLIT_PARTS).max(MAX_SPLIT_PARTS),
  sessionToken: zSessionToken(),
  tableToken: zTableToken(),
});

const byItemsSplitSchema = z.object({
  mode: z.literal("by_items"),
  items: z.array(z.string().uuid()).min(1),
  sessionToken: zSessionToken(),
  tableToken: zTableToken(),
});

const postSchema = z.discriminatedUnion("mode", [
  equalSplitSchema,
  byItemsSplitSchema,
]);

type OrderItemRow = {
  id: string;
  product_name: string;
  quantity: number;
  total: number;
};

async function loadSplitContext(
  admin: ReturnType<typeof createAdminClient>,
  orderId: string,
  tableToken: string,
  sessionToken: string
) {
  const access = await verifyTableOrderAccess(
    admin,
    orderId,
    tableToken,
    sessionToken
  );
  if ("error" in access) {
    return access;
  }

  const { data: items } = await admin
    .from("order_items")
    .select("id, product_name, quantity, total")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  const { data: splits } = await admin
    .from("split_payments")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  return {
    ...access,
    items: (items as OrderItemRow[]) ?? [],
    splits: (splits as SplitPaymentRow[]) ?? [],
  };
}

async function attachClientSecrets(
  splits: SplitPaymentRow[],
  stripeAccountId: string
) {
  const stripe = getStripe();
  const enriched = [];

  for (const split of splits) {
    let clientSecret: string | null = null;
    if (
      split.stripe_payment_intent_id &&
      split.payment_status !== "paid"
    ) {
      try {
        const pi = await stripe.paymentIntents.retrieve(
          split.stripe_payment_intent_id,
          {},
          { stripeAccount: stripeAccountId }
        );
        clientSecret = pi.client_secret;
      } catch (err) {
        logger.warn("Failed to retrieve split PI", {
          splitId: split.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    enriched.push({
      ...split,
      chargeTotal: roundMoney(Number(split.amount) + Number(split.tip_amount)),
      clientSecret,
    });
  }

  return enriched;
}

async function createSplitPaymentIntent(
  params: {
    orderId: string;
    splitId: string;
    sessionId: string;
    amount: number;
    tipAmount: number;
    org: {
      stripe_account_id: string | null;
      currency: string;
      platform_fee_percent: number;
      platform_fee_fixed: number;
    };
  }
) {
  if (!params.org.stripe_account_id) {
    throw new Error("Online payments are not available.");
  }

  const stripe = getStripe();
  const chargeTotal = roundMoney(params.amount + params.tipAmount);
  const amountCents = Math.round(chargeTotal * 100);
  const applicationFee = calcPlatformFee(params.amount, {
    feePercent: params.org.platform_fee_percent,
    feeFixed: params.org.platform_fee_fixed,
  });

  const intent = await stripe.paymentIntents.create(
    {
      amount: amountCents,
      currency: (params.org.currency ?? "eur").toLowerCase(),
      automatic_payment_methods: { enabled: true },
      application_fee_amount: applicationFee,
      metadata: {
        order_id: params.orderId,
        split_payment_id: params.splitId,
        session_id: params.sessionId,
        tip_amount: String(params.tipAmount),
        is_split: "true",
      },
    },
    { stripeAccount: params.org.stripe_account_id }
  );

  if (!intent.client_secret) {
    throw new Error("Payment could not be started.");
  }

  return { intent, clientSecret: intent.client_secret };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const cacheHeaders = noCache();
  const limited = await withRateLimit(req, "orders");
  if (limited) return limited;

  const { orderId } = await params;
  if (!isUuid(orderId)) {
    return apiError("Invalid order id.", 400, undefined, cacheHeaders);
  }

  const parsed = querySchema.safeParse({
    sessionToken: req.nextUrl.searchParams.get("sessionToken"),
    tableToken: req.nextUrl.searchParams.get("tableToken"),
  });
  if (!parsed.success) {
    return apiError("Unauthorized.", 401, undefined, cacheHeaders);
  }

  const admin = createAdminClient();
  const ctx = await loadSplitContext(
    admin,
    orderId,
    parsed.data.tableToken,
    parsed.data.sessionToken
  );
  if ("error" in ctx) {
    return apiError(ctx.error, ctx.status, undefined, cacheHeaders);
  }

  const assignedItemIds = collectAssignedItemIds(ctx.splits);
  const paidCount = ctx.splits.filter((s) => s.payment_status === "paid").length;
  const totals = sumSplitAmounts(ctx.splits);
  const orderTotal = Number(ctx.order.total);
  const orderTip = Number(ctx.order.tip_amount ?? 0);

  const splitsWithSecrets = ctx.org.stripe_account_id
    ? await attachClientSecrets(ctx.splits, ctx.org.stripe_account_id)
    : ctx.splits.map((s) => ({
        ...s,
        chargeTotal: roundMoney(Number(s.amount) + Number(s.tip_amount)),
        clientSecret: null as string | null,
      }));

  return apiSuccess(
    {
      order: {
        id: ctx.order.id,
        total: orderTotal,
        tipAmount: orderTip,
        paymentStatus: ctx.order.payment_status,
        isSplit: ctx.order.is_split,
        chargeTotal: roundMoney(orderTotal + orderTip),
      },
      items: ctx.items.map((item) => ({
        ...item,
        total: Number(item.total),
        assigned: assignedItemIds.has(item.id),
      })),
      splits: splitsWithSecrets,
      progress: {
        paid: paidCount,
        total: ctx.splits.length,
      },
      allocated: totals,
      remaining: roundMoney(orderTotal - totals.amount),
      stripeAccountId: ctx.org.stripe_account_id,
      currency: ctx.org.currency,
    },
    200,
    cacheHeaders
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const limited = await withRateLimit(req, "orders");
  if (limited) return limited;

  const { orderId } = await params;
  if (!isUuid(orderId)) {
    return apiError("Invalid order id.", 400);
  }

  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid input.", 400);
  }

  const admin = createAdminClient();
  const ctx = await loadSplitContext(
    admin,
    orderId,
    parsed.data.tableToken,
    parsed.data.sessionToken
  );
  if ("error" in ctx) {
    return apiError(ctx.error, ctx.status);
  }

  if (ctx.order.payment_status === "paid") {
    return apiError("Order is already paid.", 400);
  }

  if (!ctx.org.stripe_onboarded || !ctx.org.stripe_account_id) {
    return apiError("Online payments are not available.", 400);
  }

  const orderTotal = Number(ctx.order.total);
  const orderTip = Number(ctx.order.tip_amount ?? 0);
  const existingTotals = sumSplitAmounts(ctx.splits);

  if (ctx.splits.length > 0 && parsed.data.mode === "equal") {
    return apiError("Split already configured for this order.", 400);
  }

  if (
    parsed.data.mode === "by_items" &&
    ctx.splits.some((s) => s.items === null)
  ) {
    return apiError("This bill was split equally.", 400);
  }

  const newSplits: Array<{
    amount: number;
    tip_amount: number;
    items: string[] | null;
  }> = [];

  if (parsed.data.mode === "equal") {
    const remaining = roundMoney(orderTotal - existingTotals.amount);
    const remainingTip = roundMoney(orderTip - existingTotals.tip);
    const amounts = splitAmountEqually(remaining, parsed.data.parts);
    const tipParts = splitAmountEqually(remainingTip, parsed.data.parts);

    for (let i = 0; i < parsed.data.parts; i++) {
      newSplits.push({
        amount: amounts[i],
        tip_amount: tipParts[i],
        items: null,
      });
    }
  } else {
    const assigned = collectAssignedItemIds(ctx.splits);
    const selected = parsed.data.items.filter((id) => !assigned.has(id));
    if (selected.length === 0) {
      return apiError("Selected items are already assigned.", 400);
    }

    const itemMap = new Map(ctx.items.map((i) => [i.id, Number(i.total)]));
    for (const id of selected) {
      if (!itemMap.has(id)) {
        return apiError("Invalid order item.", 400);
      }
    }

    const amount = roundMoney(
      selected.reduce((sum, id) => sum + (itemMap.get(id) ?? 0), 0)
    );
    if (amount <= 0) {
      return apiError("Selected items total must be greater than zero.", 400);
    }

    const remainingAmount = roundMoney(orderTotal - existingTotals.amount - amount);
    if (remainingAmount < -0.001) {
      return apiError("Selected items exceed the remaining balance.", 400);
    }

    const remainingTip = roundMoney(orderTip - existingTotals.tip);
    let tipForSplit = proportionalTip(
      amount,
      orderTotal - existingTotals.amount,
      remainingTip
    );
    if (Math.abs(remainingAmount) < 0.01) {
      tipForSplit = remainingTip;
    }

    newSplits.push({
      amount,
      tip_amount: tipForSplit,
      items: selected,
    });
  }

  const projected = sumSplitAmounts([...ctx.splits, ...newSplits]);
  if (projected.amount > orderTotal + 0.001) {
    return apiError("Split total exceeds order amount.", 400);
  }

  const createdSplits: SplitPaymentRow[] = [];

  for (const split of newSplits) {
    const { data: inserted, error: insertError } = await admin
      .from("split_payments")
      .insert({
        order_id: orderId,
        amount: split.amount,
        tip_amount: split.tip_amount,
        items: split.items,
        payment_status: "processing",
      })
      .select("*")
      .single();

    if (insertError || !inserted) {
      return apiError(insertError?.message ?? "Could not create split.", 500);
    }

    const row = inserted as SplitPaymentRow;

    try {
      const { intent } = await createSplitPaymentIntent({
        orderId,
        splitId: row.id,
        sessionId: ctx.session.id,
        amount: split.amount,
        tipAmount: split.tip_amount,
        org: ctx.org,
      });

      await admin
        .from("split_payments")
        .update({
          stripe_payment_intent_id: intent.id,
          payment_status: "pending",
        })
        .eq("id", row.id);

      createdSplits.push({
        ...row,
        stripe_payment_intent_id: intent.id,
        payment_status: "pending",
      });
    } catch (err) {
      await admin.from("split_payments").delete().eq("id", row.id);
      return apiError(
        err instanceof Error ? err.message : "Payment could not be started.",
        500
      );
    }
  }

  await admin
    .from("orders")
    .update({
      is_split: true,
      payment_method: "online",
      payment_status: "processing",
    })
    .eq("id", orderId);

  const allSplits = [...ctx.splits, ...createdSplits];
  const enriched = await attachClientSecrets(allSplits, ctx.org.stripe_account_id!);

  return apiSuccess({
    splits: enriched,
    progress: {
      paid: allSplits.filter((s) => s.payment_status === "paid").length,
      total: allSplits.length,
    },
  });
}

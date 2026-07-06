import { createAdminClient } from "@/lib/supabase/admin";
import { loadActivePlans, loadPlanById, type PlanRow } from "@/lib/billing/plans";
import { computeBillingRoiJustification } from "@/lib/billing/denis-roi";
import { summarizeRevenueShare } from "@/lib/billing/revenue-share";
import {
  displayPlanName,
  getPlanTierDefinition,
  PLAN_TIER_DEFINITIONS,
  type PlanTierDefinition,
} from "@/lib/billing/tiers";
import {
  evaluateUsageAgainstLimits,
  loadOrgUsageSnapshot,
  type UsageEvaluation,
  type UsageSnapshot,
} from "@/lib/billing/usage";
import { isTrialing, shouldNotifyTrialEnding, trialDaysLeft } from "@/lib/billing/trial";
import { fromCents } from "@/lib/format";
import type { BillingCreditsSnapshot } from "@/components/dashboard/billing/billing-credits-panel";
import type { AiCreditPackage } from "@/types";

export type BillingInvoiceRow = {
  id: string;
  eventType: string;
  amountLabel: string;
  createdAt: string;
  referenceId: string | null;
};

export type BillingDashboardSnapshot = {
  org: {
    name: string;
    planId: string;
    subscriptionStatus: string;
    trialEndsAt: string | null;
    currency: string;
    platformFeePercent: number;
    platformFeeFixed: number;
    stripeOnboarded: boolean;
  };
  currentPlan: PlanRow | null;
  tier: PlanTierDefinition;
  plans: PlanRow[];
  daysLeft: number | null;
  isTrialing: boolean;
  trialEndingSoon: boolean;
  usage: UsageSnapshot;
  usageEvaluation: UsageEvaluation;
  roi: ReturnType<typeof computeBillingRoiJustification>;
  revenueShare: ReturnType<typeof summarizeRevenueShare>;
  invoices: BillingInvoiceRow[];
  nextInvoiceDate: string;
  paymentMethodLabel: string;
  credits: BillingCreditsSnapshot;
  creditPackages: AiCreditPackage[];
};

function nextMonthFirstDay(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return d.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatInvoiceRow(row: {
  id: string;
  event_type: string;
  payload: unknown;
  reference_id: string | null;
  created_at: string;
}): BillingInvoiceRow {
  const payload = row.payload as { amount?: number; balanceAfter?: number; source?: string };
  let amountLabel = "—";
  if (row.event_type === "billing.credits_purchased" && payload.amount != null) {
    amountLabel = `+${payload.amount} credits`;
  } else if (payload.balanceAfter != null) {
    amountLabel = `${payload.balanceAfter} credits balance`;
  }

  return {
    id: row.id,
    eventType: row.event_type,
    amountLabel,
    createdAt: row.created_at,
    referenceId: row.reference_id,
  };
}

export async function loadBillingDashboard(orgId: string): Promise<BillingDashboardSnapshot> {
  const admin = createAdminClient();
  const monthStartDate = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  )
    .toISOString()
    .slice(0, 10);

  const [{ data: org }, plans, { data: locations }, { data: creditsRow }, { data: aiOpsRow }, { data: packages }] =
    await Promise.all([
      admin
        .from("organizations")
        .select(
          "name, plan_id, subscription_status, trial_ends_at, currency, platform_fee_percent, platform_fee_fixed, stripe_onboarded"
        )
        .eq("id", orgId)
        .single(),
      loadActivePlans(),
      admin.from("locations").select("id").eq("org_id", orgId).eq("is_active", true),
      admin
        .from("ai_credits")
        .select("balance, lifetime_used, lifetime_purchased")
        .eq("org_id", orgId)
        .maybeSingle(),
      admin
        .from("org_ai_ops")
        .select("turns_24h, low_balance")
        .eq("org_id", orgId)
        .maybeSingle(),
      admin
        .from("ai_credit_packages")
        .select("*")
        .eq("is_active", true)
        .order("sort_order"),
    ]);

  const orgRow = org as {
    name: string;
    plan_id: string | null;
    subscription_status: string | null;
    trial_ends_at: string | null;
    currency: string;
    platform_fee_percent: number;
    platform_fee_fixed: number;
    stripe_onboarded: boolean;
  };

  const locationIds = ((locations ?? []) as Array<{ id: string }>).map((l) => l.id);
  const planId = orgRow.plan_id ?? "starter";

  const [currentPlan, usage, { data: experienceRows }, { data: paidOrders }, { data: billingEvents }] =
    await Promise.all([
      loadPlanById(planId),
      loadOrgUsageSnapshot(admin, orgId, locationIds),
      admin
        .from("experience_analytics_daily")
        .select("upsell_revenue_total, metric_date")
        .eq("org_id", orgId)
        .gte("metric_date", monthStartDate),
      locationIds.length
        ? admin
            .from("orders")
            .select("total")
            .in("location_id", locationIds)
            .eq("payment_status", "paid")
            .gte(
              "created_at",
              new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
            )
        : Promise.resolve({ data: [] }),
      admin
        .from("org_billing_events")
        .select("id, event_type, payload, reference_id, created_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  let upsellRevenue = 0;
  for (const row of experienceRows ?? []) {
    upsellRevenue += Number((row as { upsell_revenue_total: number }).upsell_revenue_total);
  }

  const tier = getPlanTierDefinition(planId);
  const usageEvaluation = evaluateUsageAgainstLimits(usage, planId);
  const planCostEuros = currentPlan ? fromCents(currentPlan.price_cents) : 0;

  const roi = computeBillingRoiJustification({
    upsellRevenueEuros: upsellRevenue,
    planCostEuros,
    currency: orgRow.currency,
  });

  const revenueShare = summarizeRevenueShare(
    (paidOrders ?? []) as Array<{ total: number }>,
    orgRow.platform_fee_percent,
    orgRow.platform_fee_fixed
  );

  const subscriptionStatus = orgRow.subscription_status ?? "trialing";
  const daysLeft = trialDaysLeft(orgRow.trial_ends_at);

  const creditsRowTyped = creditsRow as {
    balance: number;
    lifetime_used: number;
    lifetime_purchased: number;
  } | null;

  const aiOpsRowTyped = aiOpsRow as {
    turns_24h: number;
    low_balance: boolean;
  } | null;

  const credits: BillingCreditsSnapshot = {
    balance: creditsRowTyped?.balance ?? 0,
    lifetimeUsed: creditsRowTyped?.lifetime_used ?? 0,
    lifetimePurchased: creditsRowTyped?.lifetime_purchased ?? 0,
    lowBalance: aiOpsRowTyped?.low_balance ?? false,
    turns24h: aiOpsRowTyped?.turns_24h ?? null,
    currency: orgRow.currency,
  };

  const creditPackages = (packages ?? []) as AiCreditPackage[];

  return {
    org: {
      name: orgRow.name,
      planId,
      subscriptionStatus,
      trialEndsAt: orgRow.trial_ends_at,
      currency: orgRow.currency,
      platformFeePercent: orgRow.platform_fee_percent,
      platformFeeFixed: orgRow.platform_fee_fixed,
      stripeOnboarded: orgRow.stripe_onboarded,
    },
    currentPlan,
    tier,
    plans,
    daysLeft,
    isTrialing: isTrialing(subscriptionStatus),
    trialEndingSoon: shouldNotifyTrialEnding(orgRow.trial_ends_at, subscriptionStatus),
    usage,
    usageEvaluation,
    roi,
    revenueShare,
    invoices: ((billingEvents ?? []) as Array<{
      id: string;
      event_type: string;
      payload: unknown;
      reference_id: string | null;
      created_at: string;
    }>).map(formatInvoiceRow),
    nextInvoiceDate: nextMonthFirstDay(),
    paymentMethodLabel: orgRow.stripe_onboarded
      ? "Stripe Connect (venue payouts)"
      : "Not connected — add Stripe in Admin",
    credits,
    creditPackages,
  };
}

export { PLAN_TIER_DEFINITIONS, displayPlanName };

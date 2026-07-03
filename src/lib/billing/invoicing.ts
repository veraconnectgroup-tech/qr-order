import type { PlanRow } from "@/lib/billing/plans";

export type PlanChangeDirection = "upgrade" | "downgrade" | "same";

/** Monthly recurring revenue from active/trialing subscriptions (cents). */
export function computePlatformMrr(
  orgs: Array<{ plan_id: string | null; subscription_status: string | null }>,
  plans: PlanRow[]
): number {
  const planPrice = new Map(plans.map((plan) => [plan.id, plan.price_cents]));
  let mrr = 0;

  for (const org of orgs) {
    const status = org.subscription_status ?? "trialing";
    if (status !== "active" && status !== "trialing") continue;
    const planId = org.plan_id ?? "starter";
    mrr += planPrice.get(planId) ?? 0;
  }

  return mrr;
}

export function resolvePlanChangeDirection(
  currentPlanId: string | null,
  nextPlanId: string,
  plans: PlanRow[]
): PlanChangeDirection {
  const order = new Map(
    [...plans].sort((a, b) => a.sort_order - b.sort_order).map((plan, index) => [plan.id, index])
  );
  const currentIdx = order.get(currentPlanId ?? "starter") ?? 0;
  const nextIdx = order.get(nextPlanId) ?? 0;
  if (nextIdx > currentIdx) return "upgrade";
  if (nextIdx < currentIdx) return "downgrade";
  return "same";
}

/** Extend trial from current end (or now if missing) by N days. */
export function extendTrialEndDate(current: string | null, days: number): string {
  const base = current ? new Date(current) : new Date();
  base.setDate(base.getDate() + days);
  return base.toISOString();
}

export function formatMrr(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

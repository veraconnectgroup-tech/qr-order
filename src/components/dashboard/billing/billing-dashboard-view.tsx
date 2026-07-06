"use client";

import { Suspense } from "react";
import { Check, TrendingUp } from "lucide-react";
import { AnalyticsMetricCard } from "@/components/admin/analytics-metric-card";
import { BillingCreditsPanel } from "@/components/dashboard/billing/billing-credits-panel";
import { QrCard, QrCardDescription, QrCardTitle } from "@/components/design-system/qr-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPrice, fromCents } from "@/lib/format";
import { displayPlanName, type BillingDashboardSnapshot } from "@/lib/billing/snapshot";
import { getPlanTierDefinition } from "@/lib/billing/tiers";
import { cn } from "@/lib/utils";

const LOCALE = "en-GB";

function upgradeMailto(orgName: string, planName: string) {
  const subject = `Plan upgrade: ${orgName} → ${planName}`;
  return `mailto:jovica@verait.de?subject=${encodeURIComponent(subject)}`;
}

function usageBarColor(percent: number | null, exceeded: boolean) {
  if (exceeded) return "bg-red-500";
  if (percent != null && percent >= 85) return "bg-amber-500";
  return "bg-dash-accent";
}

function PlatformBillingPanel({ data }: { data: BillingDashboardSnapshot }) {
  const currentPlanId = data.org.planId;
  const currentSort = data.currentPlan?.sort_order ?? 0;

  return (
    <div className="space-y-8">
      {(data.trialEndingSoon || data.usageEvaluation.upgradeRecommended) && (
        <div className="space-y-3">
          {data.trialEndingSoon && data.daysLeft != null && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {data.daysLeft} day{data.daysLeft === 1 ? "" : "s"} left in your
              trial. Upgrade to keep Denis running without interruption.
            </div>
          )}
          {data.usageEvaluation.upgradeRecommended && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              Plan limit reached — upgrade recommended so Denis is not
              interrupted.
            </div>
          )}
        </div>
      )}

      <QrCard variant="muted" padding="md">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-dash-text-muted">
              Current plan
            </p>
            <p className="mt-1 text-2xl font-bold text-dash-text">
              {displayPlanName(currentPlanId, data.currentPlan?.name)}
            </p>
            {data.currentPlan && (
              <p className="mt-1 text-sm text-dash-text-muted">
                {formatPrice(
                  fromCents(data.currentPlan.price_cents),
                  data.currentPlan.currency,
                  LOCALE
                )}
                /{data.currentPlan.interval === "year" ? "year" : "month"}
              </p>
            )}
            <p className="mt-2 text-sm text-dash-text-secondary">
              {data.tier.tagline}
            </p>
          </div>
          <div className="text-right text-sm text-dash-text-muted">
            <p className="capitalize">Status: {data.org.subscriptionStatus}</p>
            {data.isTrialing && (
              <p className="mt-1 text-amber-300">
                14-day trial
                {data.daysLeft != null && data.daysLeft > 0 && (
                  <> · {data.daysLeft} day{data.daysLeft === 1 ? "" : "s"} left</>
                )}
                {data.daysLeft != null && data.daysLeft <= 0 && <> · expired</>}
              </p>
            )}
            <p className="mt-1">Next invoice: {data.nextInvoiceDate}</p>
          </div>
        </div>
      </QrCard>

      <section className="space-y-3">
        <QrCardTitle>Usage this month</QrCardTitle>
        <QrCard variant="muted" padding="md">
          <div className="grid gap-4 sm:grid-cols-2">
            {data.usageEvaluation.metrics.map((metric) => (
              <div key={metric.key} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-dash-text-secondary">{metric.label}</span>
                  <span className="tabular-nums text-dash-text">
                    {metric.used.toLocaleString(LOCALE)}
                    {metric.limit != null
                      ? ` / ${metric.limit.toLocaleString(LOCALE)}`
                      : ""}
                    {metric.key === "storageMb" ? " MB" : ""}
                  </span>
                </div>
                {metric.limit != null && (
                  <div className="h-2 overflow-hidden rounded-full bg-dash-surface-overlay">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        usageBarColor(metric.percent, metric.exceeded)
                      )}
                      style={{ width: `${Math.min(100, metric.percent ?? 0)}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </QrCard>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AnalyticsMetricCard
          label="Platform fee rate"
          value={`${data.org.platformFeePercent}%`}
        />
        <AnalyticsMetricCard
          label="GMV this month"
          value={formatPrice(
            data.revenueShare.orderVolume,
            data.org.currency,
            LOCALE
          )}
        />
        <AnalyticsMetricCard
          label="Platform fees"
          value={formatPrice(
            data.revenueShare.platformFeesCollected,
            data.org.currency,
            LOCALE
          )}
        />
        <AnalyticsMetricCard
          label="Paid orders"
          value={String(data.revenueShare.orderCount)}
        />
      </div>

      <QrCard
        variant="muted"
        padding="md"
        className="border-emerald-500/20 bg-emerald-500/5"
      >
        <div className="flex items-start gap-3">
          <TrendingUp className="mt-0.5 size-5 shrink-0 text-emerald-400" />
          <div>
            <QrCardTitle className="text-base">Denis ROI</QrCardTitle>
            <QrCardDescription className="text-dash-text-secondary">
              {data.roi.headline}
            </QrCardDescription>
            <p className="mt-1 text-sm font-medium text-emerald-300">
              {data.roi.detail}
            </p>
          </div>
        </div>
      </QrCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <QrCard variant="muted" padding="md">
          <QrCardTitle className="text-base">Payment method</QrCardTitle>
          <p className="mt-3 text-sm text-dash-text-secondary">
            {data.paymentMethodLabel}
          </p>
        </QrCard>

        <QrCard variant="muted" padding="md">
          <QrCardTitle className="text-base">Invoice history</QrCardTitle>
          {data.invoices.length === 0 ? (
            <p className="mt-3 text-sm text-dash-text-muted">
              No billing events yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.invoices.slice(0, 8).map((invoice) => (
                <li
                  key={invoice.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-dash-border-subtle px-3 py-2 text-sm"
                >
                  <span className="text-dash-text-secondary">
                    {invoice.eventType}
                  </span>
                  <span className="tabular-nums text-dash-text">
                    {invoice.amountLabel}
                  </span>
                  <span className="text-xs text-dash-text-disabled">
                    {new Date(invoice.createdAt).toLocaleDateString(LOCALE)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </QrCard>
      </div>

      <section className="space-y-4">
        <div>
          <QrCardTitle>Compare plans</QrCardTitle>
          <QrCardDescription>
            Platform tiers for ordering, ops, and limits. AI credits are sold
            separately as pay-as-you-go packs above.
          </QrCardDescription>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {data.plans.map((plan) => {
            const tier = getPlanTierDefinition(plan.id);
            const isCurrent = plan.id === currentPlanId;
            const canUpgrade = plan.sort_order > currentSort;
            const features =
              tier.highlights.length > 0 ? tier.highlights : plan.features;

            return (
              <QrCard
                key={plan.id}
                variant="muted"
                padding="md"
                className={cn(
                  "flex flex-col",
                  isCurrent && "border-dash-accent/40 bg-dash-accent/5"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-semibold text-dash-text">
                    {displayPlanName(plan.id, plan.name)}
                  </h3>
                  {isCurrent && (
                    <span className="rounded-full bg-dash-accent/15 px-2 py-0.5 text-xs font-medium text-dash-accent">
                      Current
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-dash-text-muted">{tier.tagline}</p>
                <p className="mt-3 font-mono text-2xl font-bold text-dash-text">
                  {formatPrice(fromCents(plan.price_cents), plan.currency, LOCALE)}
                  <span className="text-sm font-normal text-dash-text-disabled">
                    /mo
                  </span>
                </p>
                <ul className="mt-4 flex-1 space-y-2">
                  {features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm text-dash-text-secondary"
                    >
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {isCurrent ? (
                    <span className="block rounded-lg border border-dash-surface-overlay px-4 py-2.5 text-center text-sm text-dash-text-muted">
                      Your current plan
                    </span>
                  ) : canUpgrade ? (
                    <a
                      href={upgradeMailto(
                        data.org.name,
                        displayPlanName(plan.id, plan.name)
                      )}
                      className="block rounded-lg bg-dash-accent px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-dash-accent-hover"
                    >
                      Upgrade
                    </a>
                  ) : (
                    <span className="block rounded-lg border border-dash-surface-overlay px-4 py-2.5 text-center text-sm text-dash-text-disabled">
                      Included in higher tier
                    </span>
                  )}
                </div>
              </QrCard>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function BillingDashboardView({ data }: { data: BillingDashboardSnapshot }) {
  return (
    <Tabs defaultValue="credits" className="space-y-6">
      <TabsList className="h-auto w-full justify-start gap-1 rounded-xl border border-dash-border bg-dash-surface/60 p-1 sm:w-auto">
        <TabsTrigger
          value="credits"
          className="rounded-lg px-4 py-2 data-[state=active]:bg-dash-accent data-[state=active]:text-white"
        >
          AI credits
        </TabsTrigger>
        <TabsTrigger
          value="platform"
          className="rounded-lg px-4 py-2 data-[state=active]:bg-dash-surface-overlay data-[state=active]:text-dash-text"
        >
          Platform plan
        </TabsTrigger>
      </TabsList>

      <TabsContent value="credits" className="mt-0 focus-visible:outline-none">
        <Suspense fallback={null}>
          <BillingCreditsPanel
            credits={{
              ...data.credits,
              currency: data.org.currency,
            }}
            packages={data.creditPackages}
          />
        </Suspense>
      </TabsContent>

      <TabsContent value="platform" className="mt-0 focus-visible:outline-none">
        <PlatformBillingPanel data={data} />
      </TabsContent>
    </Tabs>
  );
}

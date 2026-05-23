import { Suspense } from "react";
import { AdminAnalyticsCharts, AdminPaymentMethodsChart } from "@/components/admin/admin-analytics-charts";
import { AnalyticsDateRangePicker } from "@/components/admin/analytics-date-range-picker";
import { AnalyticsMetricCard } from "@/components/admin/analytics-metric-card";
import { DatevExportPanel } from "@/components/admin/datev-export-panel";
import { FeedbackRatingKpiCard } from "@/components/admin/feedback-rating-kpi-card";
import { TipsKpiCard } from "@/components/admin/tips-kpi-card";
import {
  getPreviousAnalyticsRange,
  resolveAnalyticsDateRange,
  type AnalyticsSearchParams,
} from "@/lib/analytics/date-range";
import { loadAdminAnalyticsSnapshot } from "@/lib/analytics/admin-analytics";
import { requireAdmin } from "@/lib/auth/session";
import { formatPrice } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

function DateRangePickerFallback() {
  return <div className="h-20 w-full max-w-xl animate-pulse rounded-lg bg-neutral-100" />;
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<AnalyticsSearchParams>;
}) {
  const staff = await requireAdmin();
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("currency")
    .eq("id", staff.org_id)
    .single();
  const currency = (org as { currency: string } | null)?.currency ?? "EUR";

  const params = await searchParams;
  const range = resolveAnalyticsDateRange(params);
  const snapshot = await loadAdminAnalyticsSnapshot(
    range,
    getPreviousAnalyticsRange(range)
  );

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Analytics</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Revenue, orders, and guest feedback for your location.
          </p>
        </div>
        <Suspense fallback={<DateRangePickerFallback />}>
          <AnalyticsDateRangePicker />
        </Suspense>
      </div>

      {!snapshot ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center text-neutral-600 shadow-sm">
          No location assigned. Analytics require at least one location.
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <AnalyticsMetricCard
              label="Total revenue"
              value={formatPrice(snapshot.kpis.revenue, currency)}
              hint="Paid orders only"
              changePct={snapshot.kpis.revenueChangePct}
            />
            <AnalyticsMetricCard
              label="Orders"
              value={String(snapshot.kpis.ordersCount)}
              hint="Excludes cancelled"
              changePct={snapshot.kpis.ordersChangePct}
            />
            <AnalyticsMetricCard
              label="Average ticket"
              value={formatPrice(snapshot.kpis.avgTicket, currency)}
              hint="Revenue ÷ orders"
              changePct={snapshot.kpis.avgTicketChangePct}
            />
            <TipsKpiCard currency={currency} />
            <FeedbackRatingKpiCard />
          </div>

          <AdminAnalyticsCharts data={snapshot} currency={currency} />

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <AdminPaymentMethodsChart
              paymentMethods={snapshot.paymentMethods}
              currency={currency}
            />
            <DatevExportPanel />
          </div>
        </>
      )}
    </div>
  );
}

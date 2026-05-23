import { Suspense } from "react";
import { AnalyticsDateRangePicker } from "@/components/admin/analytics/date-range-picker";
import { AvgTicketKpiCard } from "@/components/admin/analytics/avg-ticket-kpi-card";
import { OrderSourceChart } from "@/components/admin/analytics/order-source-chart";
import { OrdersByHourChart } from "@/components/admin/analytics/orders-by-hour-chart";
import { OrdersKpiCard } from "@/components/admin/analytics/orders-kpi-card";
import { PaymentMethodsChart } from "@/components/admin/analytics/payment-methods-chart";
import { RevenueChart } from "@/components/admin/analytics/revenue-chart";
import { RevenueKpiCard } from "@/components/admin/analytics/revenue-kpi-card";
import { TopProductsChart } from "@/components/admin/analytics/top-products-chart";
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
import { createAdminClient } from "@/lib/supabase/admin";

function DateRangePickerFallback() {
  return (
    <div className="h-20 w-full max-w-xl animate-pulse rounded-lg bg-neutral-100" />
  );
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
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <RevenueKpiCard
              currency={currency}
              revenue={snapshot.kpis.revenue}
              changePct={snapshot.kpis.revenueChangePct}
            />
            <OrdersKpiCard
              ordersCount={snapshot.kpis.ordersCount}
              changePct={snapshot.kpis.ordersChangePct}
            />
            <AvgTicketKpiCard
              currency={currency}
              avgTicket={snapshot.kpis.avgTicket}
              changePct={snapshot.kpis.avgTicketChangePct}
            />
            <TipsKpiCard currency={currency} range={range} />
            <FeedbackRatingKpiCard range={range} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-6">
            <RevenueChart
              data={snapshot.revenueSeries}
              currency={currency}
              className="lg:col-span-6"
            />
            <TopProductsChart
              data={snapshot.topItems}
              currency={currency}
              className="lg:col-span-3"
            />
            <OrdersByHourChart
              data={snapshot.hourlyOrders}
              className="lg:col-span-3"
            />
            <PaymentMethodsChart
              data={snapshot.paymentMethods}
              currency={currency}
              className="lg:col-span-2"
            />
            <OrderSourceChart
              data={snapshot.orderSources}
              className="lg:col-span-2"
            />
            <div className="lg:col-span-2">
              <DatevExportPanel />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

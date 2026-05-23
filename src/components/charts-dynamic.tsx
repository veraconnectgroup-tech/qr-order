"use client";

import dynamic from "next/dynamic";

function ChartSkeleton() {
  return (
    <div className="h-[280px] w-full animate-pulse rounded-lg bg-neutral-100" />
  );
}

export const RevenueChart = dynamic(
  () =>
    import("@/components/admin/analytics/revenue-chart").then((m) => ({
      default: m.RevenueChart,
    })),
  { loading: () => <ChartSkeleton /> }
);

export const OrdersByHourChart = dynamic(
  () =>
    import("@/components/admin/analytics/orders-by-hour-chart").then((m) => ({
      default: m.OrdersByHourChart,
    })),
  { loading: () => <ChartSkeleton /> }
);

export const OrderSourceChart = dynamic(
  () =>
    import("@/components/admin/analytics/order-source-chart").then((m) => ({
      default: m.OrderSourceChart,
    })),
  { loading: () => <ChartSkeleton /> }
);

export const PaymentMethodsChart = dynamic(
  () =>
    import("@/components/admin/analytics/payment-methods-chart").then((m) => ({
      default: m.PaymentMethodsChart,
    })),
  { loading: () => <ChartSkeleton /> }
);

export const TopProductsChart = dynamic(
  () =>
    import("@/components/admin/analytics/top-products-chart").then((m) => ({
      default: m.TopProductsChart,
    })),
  { loading: () => <ChartSkeleton /> }
);

export const PlatformBarChart = dynamic(
  () =>
    import("@/components/platform/platform-bar-chart").then((m) => ({
      default: m.PlatformBarChart,
    })),
  { loading: () => <ChartSkeleton /> }
);

export const AnalyticsCharts = dynamic(
  () =>
    import("@/components/dashboard/analytics-charts").then((m) => ({
      default: m.AnalyticsCharts,
    })),
  { loading: () => <ChartSkeleton /> }
);

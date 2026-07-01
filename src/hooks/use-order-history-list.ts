"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  resolveAnalyticsDateRange,
  type AnalyticsSearchParams,
} from "@/lib/analytics/date-range";
import { readApiErrorMessage } from "@/lib/api-error-client";
import { sumTips } from "@/lib/orders/tips";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import {
  computeStats,
  getPreviousRange,
} from "@/components/dashboard/order-history-list/stats";
import type { OrderWithDetails } from "@/types";

export function useOrderHistoryList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currency, inPersonPaymentLocation, staffRole } = useDashboard();

  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [statsOrders, setStatsOrders] = useState<OrderWithDetails[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refundTarget, setRefundTarget] = useState<OrderWithDetails | null>(
    null
  );
  const [searchInput, setSearchInput] = useState(
    () => searchParams.get("q") ?? ""
  );
  const [resendingId, setResendingId] = useState<string | null>(null);

  const queryString = searchParams.toString();
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = 50;

  const rangeParams = useMemo(
    (): AnalyticsSearchParams => ({
      preset: searchParams.get("preset") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    }),
    [searchParams]
  );
  const range = useMemo(
    () => resolveAnalyticsDateRange(rangeParams),
    [rangeParams]
  );
  const previousRange = useMemo(() => getPreviousRange(range), [range]);

  const updateParams = useCallback(
    (patch: Record<string, string | null>, resetPage = true) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      if (resetPage) next.delete("page");
      router.push(`/dashboard/history?${next.toString()}`);
    },
    [router, searchParams]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/history?${queryString}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(readApiErrorMessage(json, res.status, "Failed to load history"));
      }
      setOrders(json.data.orders ?? []);
      setStatsOrders(json.data.statsOrders ?? []);
      setTotal(json.data.total ?? 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load history");
      setOrders([]);
      setStatsOrders([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setSearchInput(searchParams.get("q") ?? "");
  }, [searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const current = searchParams.get("q") ?? "";
      if (searchInput.trim() === current.trim()) return;
      updateParams({ q: searchInput.trim() || null });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [searchInput, searchParams, updateParams]);

  const stats = useMemo(() => computeStats(statsOrders), [statsOrders]);
  const totalTips = useMemo(() => sumTips(statsOrders), [statsOrders]);
  const previousFiltered = useMemo(
    () =>
      statsOrders.filter((o) => {
        const t = new Date(o.created_at).getTime();
        return (
          t >= previousRange.start.getTime() &&
          t <= previousRange.end.getTime()
        );
      }),
    [statsOrders, previousRange]
  );
  const prevStats = useMemo(
    () => computeStats(previousFiltered),
    [previousFiltered]
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const rangeStart = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, total);

  const canExport = ["owner", "manager"].includes(staffRole);

  async function handleRefund(orderId: string, reason: string, amount?: number) {
    const res = await fetch(`/api/orders/${orderId}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, amount }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(readApiErrorMessage(json, res.status, "Refund failed"));
    }
    toast.success("Refund issued");
    await load();
  }

  async function handleResendReceipt(orderId: string) {
    setResendingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/resend-receipt`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(readApiErrorMessage(json, res.status, "Could not send receipt"));
      }
      toast.success("Receipt sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send receipt");
    } finally {
      setResendingId(null);
    }
  }

  return {
    currency,
    inPersonPaymentLocation,
    staffRole,
    orders,
    statsOrders,
    total,
    loading,
    expandedId,
    setExpandedId,
    refundTarget,
    setRefundTarget,
    searchInput,
    setSearchInput,
    resendingId,
    searchParams,
    queryString,
    range,
    updateParams,
    stats,
    totalTips,
    prevStats,
    totalPages,
    safePage,
    rangeStart,
    rangeEnd,
    canExport,
    handleRefund,
    handleResendReceipt,
    load,
  };
}

export type OrderHistoryListState = ReturnType<typeof useOrderHistoryList>;

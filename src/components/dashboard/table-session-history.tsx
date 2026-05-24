"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
  RotateCw,
} from "lucide-react";
import { toast } from "sonner";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { formatOrderNumber, formatPrice } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payment-methods";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type HistorySession = {
  id: string;
  table_id: string;
  table_name: string;
  zone_name: string | null;
  status: string;
  bill_status: string;
  opened_at: string;
  closed_at: string | null;
  order_count: number;
  total: number;
  paid_total: number;
  unpaid_total: number;
  payment_methods: string[];
};

type BillOrder = {
  id: string;
  order_number: number;
  status: string;
  total: number;
  tip_amount: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
  order_items: Array<{
    name: string;
    quantity: number;
    unit_price: number;
  }>;
};

type Props = {
  onReopened?: () => void;
};

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

function formatTimeRange(openedAt: string, closedAt: string | null) {
  const fmt = (value: string) =>
    new Date(value).toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  if (!closedAt) return fmt(openedAt);
  return `${fmt(openedAt)} – ${fmt(closedAt)}`;
}

function billStatusLabel(
  session: HistorySession,
  inPersonLocation: "bar" | "counter" | "table"
) {
  const methods = session.payment_methods
    .map((method) => paymentMethodLabel(method, inPersonLocation))
    .join(", ");

  if (session.bill_status === "settled") {
    return `Settled${methods ? ` (${methods})` : ""}`;
  }
  if (session.bill_status === "void") {
    return "Void";
  }
  if (session.unpaid_total > 0) {
    return `Unpaid`;
  }
  return session.bill_status;
}

export function TableSessionHistory({ onReopened }: Props) {
  const {
    locationId,
    currency,
    staffRole,
    inPersonPaymentLocation,
  } = useDashboard();

  const todayIso = useMemo(() => toIsoDate(new Date()), []);
  const [date, setDate] = useState(todayIso);
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [ordersBySession, setOrdersBySession] = useState<
    Record<string, BillOrder[]>
  >({});
  const [loadingOrders, setLoadingOrders] = useState<string | null>(null);
  const [reopenTarget, setReopenTarget] = useState<HistorySession | null>(
    null
  );
  const [reopening, setReopening] = useState(false);

  const canReopen = ["owner", "manager"].includes(staffRole);
  const isToday = date === todayIso;
  const canGoForward = date < todayIso;

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        location_id: locationId,
        date,
        limit: "50",
      });
      const res = await fetch(`/api/sessions/history?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Could not load session history");
      }
      const data = json.data as { sessions: HistorySession[] };
      setSessions(data.sessions ?? []);
      setExpandedId(null);
      setOrdersBySession({});
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load session history"
      );
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [locationId, date]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  function shiftDate(days: number) {
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + days);
    setDate(toIsoDate(next));
  }

  async function toggleExpand(session: HistorySession) {
    if (expandedId === session.id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(session.id);

    if (ordersBySession[session.id]) return;

    setLoadingOrders(session.id);
    try {
      const res = await fetch(`/api/sessions/${session.id}/bill`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Could not load orders");
      }
      const data = json.data as { orders: BillOrder[] };
      setOrdersBySession((prev) => ({
        ...prev,
        [session.id]: data.orders ?? [],
      }));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load orders"
      );
      setExpandedId(null);
    } finally {
      setLoadingOrders(null);
    }
  }

  async function confirmReopen() {
    if (!reopenTarget) return;

    setReopening(true);
    try {
      const res = await fetch(`/api/sessions/${reopenTarget.id}/reopen`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Could not reopen table");
      }

      toast.success(`Nova sesija kreirana na ${reopenTarget.table_name}`);
      setReopenTarget(null);
      onReopened?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not reopen table"
      );
    } finally {
      setReopening(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-dash-border bg-dash-surface p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-dash-text">
          Istorija stolova — {formatDisplayDate(date)}
        </h2>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => shiftDate(-1)}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-dash-surface-overlay bg-dash-bg px-3 py-2 text-sm text-dash-text-secondary transition hover:bg-dash-surface-raised"
          >
            <ChevronLeft className="size-4" />
            Juče
          </button>
          <button
            type="button"
            onClick={() => setDate(toIsoDate(new Date()))}
            disabled={isToday}
            className={cn(
              "inline-flex min-h-11 items-center rounded-lg border px-4 py-2 text-sm font-medium transition",
              isToday
                ? "border-dash-accent bg-dash-accent text-white"
                : "border-dash-surface-overlay bg-dash-bg text-dash-text-secondary hover:bg-dash-surface-raised"
            )}
          >
            Danas
          </button>
          <button
            type="button"
            onClick={() => shiftDate(1)}
            disabled={!canGoForward}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-dash-surface-overlay bg-dash-bg px-3 py-2 text-sm text-dash-text-secondary transition hover:bg-dash-surface-raised disabled:cursor-not-allowed disabled:opacity-40"
          >
            Sutra
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-28 rounded-xl bg-dash-surface-raised"
            />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-dash-surface-overlay bg-dash-surface/50 px-4 py-12 text-center">
          <p className="font-medium text-dash-text-secondary">
            Nema zatvorenih sesija za ovaj dan
          </p>
          <p className="mt-1 text-sm text-dash-text-disabled">
            Promeni datum ili proveri da li su stolovi zatvoreni.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {sessions.map((session) => {
            const expanded = expandedId === session.id;
            const orders = ordersBySession[session.id] ?? [];
            const tableLabel = session.zone_name
              ? `${session.table_name} (${session.zone_name})`
              : session.table_name;

            return (
              <li
                key={session.id}
                className="overflow-hidden rounded-xl border border-dash-border bg-dash-surface"
              >
                <button
                  type="button"
                  onClick={() => void toggleExpand(session)}
                  className="flex w-full flex-col gap-2 p-4 text-left transition hover:bg-dash-surface-raised/40 sm:p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-dash-text">
                        {tableLabel}
                      </p>
                      <p className="mt-1 text-sm text-dash-text-muted">
                        {formatTimeRange(session.opened_at, session.closed_at)} •{" "}
                        {session.order_count}{" "}
                        {session.order_count === 1 ? "order" : "orders"} •{" "}
                        <span className="font-mono text-dash-accent">
                          {formatPrice(session.total, currency)}
                        </span>
                      </p>
                    </div>
                    <ChevronDown
                      className={cn(
                        "mt-1 size-5 shrink-0 text-dash-text-muted transition",
                        expanded && "rotate-180"
                      )}
                    />
                  </div>

                  <p className="text-sm text-emerald-400">
                    ✅ {billStatusLabel(session, inPersonPaymentLocation)}
                  </p>
                </button>

                {expanded && (
                  <div className="border-t border-dash-border px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
                    {loadingOrders === session.id ? (
                      <div className="flex items-center gap-2 py-4 text-sm text-dash-text-muted">
                        <Loader2 className="size-4 animate-spin" />
                        Učitavanje narudžbina…
                      </div>
                    ) : orders.length === 0 ? (
                      <p className="py-2 text-sm text-dash-text-disabled">
                        Nema narudžbina u ovoj sesiji.
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {orders.map((order) => (
                          <li
                            key={order.id}
                            className="rounded-lg border border-dash-border bg-dash-bg px-3 py-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-mono text-sm font-semibold text-dash-text">
                                {formatOrderNumber(order.order_number)}
                              </span>
                              <span className="font-mono text-sm text-dash-accent">
                                {formatPrice(
                                  order.total + order.tip_amount,
                                  currency
                                )}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-dash-text-muted">
                              {paymentMethodLabel(
                                order.payment_method,
                                inPersonPaymentLocation
                              )}{" "}
                              · {order.payment_status}
                            </p>
                            {order.order_items.length > 0 && (
                              <ul className="mt-2 space-y-1 text-sm text-dash-text-secondary">
                                {order.order_items.map((item, index) => (
                                  <li key={`${order.id}-${index}`}>
                                    {item.quantity}× {item.name}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    {canReopen && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setReopenTarget(session);
                        }}
                        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-dash-surface-overlay bg-dash-surface-raised px-4 py-2.5 text-sm font-medium text-dash-text transition hover:bg-dash-surface-overlay sm:w-auto"
                      >
                        <RotateCw className="size-4" />
                        Ponovo aktiviraj
                      </button>
                    )}
                  </div>
                )}

                {!expanded && canReopen && (
                  <div className="border-t border-dash-border px-4 pb-4 pt-0 sm:px-5">
                    <button
                      type="button"
                      onClick={() => setReopenTarget(session)}
                      className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-dash-surface-overlay bg-dash-surface-raised px-4 py-2.5 text-sm font-medium text-dash-text transition hover:bg-dash-surface-overlay sm:w-auto"
                    >
                      <RotateCw className="size-4" />
                      Ponovo aktiviraj
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={reopenTarget != null}
        onOpenChange={(open) => {
          if (!open) setReopenTarget(null);
        }}
      >
        <DialogContent className="border-dash-border bg-dash-surface text-dash-text sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-dash-text">
              Ponovo aktiviraj sto
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-dash-text-secondary">
            Kreirati novu sesiju na{" "}
            <span className="font-semibold text-dash-text">
              {reopenTarget?.table_name}
            </span>
            ? Stare narudžbine neće biti prenesene.
          </p>
          <DialogFooter className="border-dash-border bg-transparent">
            <button
              type="button"
              disabled={reopening}
              onClick={() => setReopenTarget(null)}
              className="rounded-lg px-4 py-2 text-sm text-dash-text-muted hover:text-dash-text-secondary"
            >
              Otkaži
            </button>
            <button
              type="button"
              disabled={reopening}
              onClick={() => void confirmReopen()}
              className="inline-flex items-center gap-2 rounded-lg bg-dash-accent px-4 py-2 text-sm font-semibold text-white hover:bg-dash-accent-hover disabled:opacity-50"
            >
              {reopening ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Kreiranje…
                </>
              ) : (
                "Potvrdi"
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

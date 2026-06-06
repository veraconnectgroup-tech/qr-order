"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TerminalPayment } from "@/components/dashboard/terminal-payment";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { formatOrderNumber, formatPrice } from "@/lib/format";
import {
  getStaffSelectablePaymentMethods,
  paymentMethodLabel,
  type StaffSelectablePaymentMethod,
} from "@/lib/payment-methods";
import { createClient } from "@/lib/supabase/client";
import { waiterUiEnglish } from "@/lib/i18n/waiter-app-ui";
import { cn } from "@/lib/utils";

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

type SessionBill = {
  session_id: string;
  orders: BillOrder[];
  subtotal: number;
  tips: number;
  grand_total: number;
  paid_count: number;
  unpaid_count: number;
  all_paid: boolean;
};

type LocationPaymentSettings = {
  payment_online_enabled: boolean;
  payment_at_bar_enabled: boolean;
  payment_card_at_table_enabled: boolean;
};

const SETTLE_METHODS = new Set<StaffSelectablePaymentMethod>([
  "at_bar",
  "card_at_table",
  "card_terminal",
]);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableName: string;
  sessionId: string | null;
  onSettled?: () => void;
};

function orderItemsSummary(items: BillOrder["order_items"]) {
  if (items.length === 0) return null;
  const [first, ...rest] = items;
  return { first, rest };
}

export function TableBillPanel({
  open,
  onOpenChange,
  tableName,
  sessionId,
  onSettled,
}: Props) {
  const {
    locationId,
    currency,
    stripeOnboarded,
    inPersonPaymentLocation,
  } = useDashboard();

  const [loading, setLoading] = useState(false);
  const [settling, setSettling] = useState(false);
  const [bill, setBill] = useState<SessionBill | null>(null);
  const [settings, setSettings] = useState<LocationPaymentSettings | null>(
    null
  );
  const [paymentMethod, setPaymentMethod] =
    useState<StaffSelectablePaymentMethod>("at_bar");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);

  const availableMethods = useMemo(() => {
    if (!settings) return ["at_bar"] as StaffSelectablePaymentMethod[];
    return getStaffSelectablePaymentMethods({
      stripeOnboarded,
      paymentOnlineEnabled: settings.payment_online_enabled,
      paymentAtBarEnabled: settings.payment_at_bar_enabled,
      paymentCardAtTableEnabled: settings.payment_card_at_table_enabled,
    }).filter((method) => SETTLE_METHODS.has(method));
  }, [settings, stripeOnboarded]);

  useEffect(() => {
    if (!availableMethods.includes(paymentMethod)) {
      setPaymentMethod(availableMethods[0] ?? "at_bar");
    }
  }, [availableMethods, paymentMethod]);

  const unpaidOrders = useMemo(
    () => bill?.orders.filter((order) => order.payment_status !== "paid") ?? [],
    [bill]
  );

  const unpaidDue = unpaidOrders.reduce(
    (sum, order) => sum + order.total + order.tip_amount,
    0
  );

  const load = useCallback(async () => {
    if (!sessionId) {
      setBill(null);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/bill`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Could not load bill");
      }
      setBill(json.data as SessionBill);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load bill"
      );
      setBill(null);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("locations")
        .select(
          "payment_online_enabled, payment_at_bar_enabled, payment_card_at_table_enabled"
        )
        .eq("id", locationId)
        .maybeSingle();

      if (!cancelled && data) {
        setSettings(data as LocationPaymentSettings);
      }
    })();

    void load();

    return () => {
      cancelled = true;
    };
  }, [open, load, locationId]);

  async function settleSession(method: StaffSelectablePaymentMethod) {
    if (!sessionId) return;

    setSettling(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/bill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_method: method }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Could not settle bill");
      }

      toast.success(
        bill?.all_paid ? "Table session closed." : "Bill settled and table closed."
      );
      setConfirmOpen(false);
      onOpenChange(false);
      onSettled?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not settle bill"
      );
    } finally {
      setSettling(false);
    }
  }

  function handlePrimaryAction() {
    if (!bill) return;
    setConfirmOpen(true);
  }

  async function handleConfirmSettle() {
    if (
      paymentMethod === "card_terminal" &&
      !bill?.all_paid &&
      stripeOnboarded
    ) {
      setConfirmOpen(false);
      setTerminalOpen(true);
      return;
    }

    await settleSession(paymentMethod);
  }

  const barChipLabel = paymentMethodLabel("at_bar", inPersonPaymentLocation);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="dashboard-theme flex max-h-[90dvh] flex-col border-dash-border bg-dash-surface text-dash-text ring-dash-border-subtle sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-left text-xl font-bold text-dash-text">
              {waiterUiEnglish("action.bill")} — {tableName}
            </DialogTitle>
          </DialogHeader>

          {!sessionId ? (
            <p className="py-6 text-sm text-dash-text-muted">
              No active session for this table.
            </p>
          ) : loading ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-20 rounded-xl bg-dash-surface-raised" />
              <Skeleton className="h-20 rounded-xl bg-dash-surface-raised" />
              <Skeleton className="h-10 rounded-lg bg-dash-surface-raised" />
            </div>
          ) : !bill || bill.orders.length === 0 ? (
            <p className="py-6 text-sm text-dash-text-muted">
              No orders on this session.
            </p>
          ) : (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              <ul className="space-y-3">
                {bill.orders.map((order) => {
                  const paid = order.payment_status === "paid";
                  const summary = orderItemsSummary(order.order_items);

                  return (
                    <li
                      key={order.id}
                      className="rounded-xl border border-dash-border-subtle bg-dash-bg/40 px-3 py-3 transition-colors hover:border-dash-border hover:bg-dash-surface-raised/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-mono text-sm font-bold text-dash-text">
                          {formatOrderNumber(order.order_number)}
                        </p>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-xs font-medium",
                            paid ? "text-emerald-400" : "text-amber-400"
                          )}
                        >
                          {paid ? (
                            <CheckCircle2 className="size-3.5" />
                          ) : (
                            <Clock className="size-3.5" />
                          )}
                          {paid ? "Paid" : "Unpaid"}
                          <span className="text-dash-text-muted">
                            ({paymentMethodLabel(order.payment_method, inPersonPaymentLocation)})
                          </span>
                        </span>
                      </div>

                      {summary && (
                        <div className="mt-2 text-sm text-dash-text-secondary">
                          <p>{summary.first.name}</p>
                          {summary.rest.map((item, index) => (
                            <p
                              key={`${order.id}-item-${index}`}
                              className="text-dash-text-muted"
                            >
                              {item.quantity}× {item.name}
                            </p>
                          ))}
                        </div>
                      )}

                      <p className="mt-2 font-mono text-sm font-semibold text-dash-accent">
                        Total: {formatPrice(order.total + order.tip_amount, currency)}
                      </p>
                    </li>
                  );
                })}
              </ul>

              <div className="space-y-1 border-t border-dash-border-subtle pt-4 text-sm">
                <div className="flex justify-between text-dash-text-secondary">
                  <span>Subtotal</span>
                  <span className="font-mono">
                    {formatPrice(bill.subtotal, currency)}
                  </span>
                </div>
                {bill.tips > 0 && (
                  <div className="flex justify-between text-dash-text-secondary">
                    <span>Tips</span>
                    <span className="font-mono">
                      {formatPrice(bill.tips, currency)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-dash-text">
                  <span>UKUPNO</span>
                  <span className="font-mono text-dash-accent">
                    {formatPrice(bill.grand_total, currency)}
                  </span>
                </div>
                <p className="pt-1 text-xs text-dash-text-muted">
                  Paid: {bill.paid_count} | Unpaid: {bill.unpaid_count}
                </p>
              </div>

              {!bill.all_paid && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-dash-text-disabled">
                    Način plaćanja
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {availableMethods.map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        className={cn(
                          "min-h-10 rounded-lg px-3 py-2 text-sm font-medium transition active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-dash-accent/40 focus-visible:outline-none",
                          paymentMethod === method
                            ? "bg-dash-accent text-white"
                            : "bg-dash-surface-raised text-dash-text-secondary hover:bg-dash-surface-overlay hover:text-dash-text"
                        )}
                      >
                        {method === "at_bar"
                          ? barChipLabel
                          : paymentMethodLabel(method, inPersonPaymentLocation)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {bill && bill.orders.length > 0 && (
            <DialogFooter className="shrink-0 border-t border-dash-border-subtle bg-dash-surface px-0 pt-4 sm:justify-stretch mx-0 mb-0 rounded-none">
              <Button
                type="button"
                disabled={settling}
                className="min-h-12 w-full bg-dash-accent text-base font-semibold hover:bg-dash-accent-hover"
                onClick={handlePrimaryAction}
              >
                <Banknote className="mr-2 size-5" />
                {settling
                  ? "Processing…"
                  : bill.all_paid
                    ? "Zatvori sto"
                    : "Naplati i zatvori"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="dashboard-theme border-dash-border bg-dash-surface text-dash-text ring-dash-border-subtle sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {bill?.all_paid ? "Zatvori sto?" : "Naplati i zatvori?"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-dash-text-muted">
            {bill?.all_paid
              ? `Close session for ${tableName}? All orders are already paid.`
              : paymentMethod === "card_terminal"
                ? `Collect ${formatPrice(unpaidDue, currency)} on the terminal, then close ${tableName}?`
                : `Settle ${formatPrice(unpaidDue, currency)} via ${paymentMethodLabel(paymentMethod, inPersonPaymentLocation)} and close ${tableName}?`}
          </p>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="border-dash-border-subtle"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={settling}
              className="bg-dash-accent hover:bg-dash-accent-hover"
              onClick={() => void handleConfirmSettle()}
            >
              {settling ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Confirm"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {sessionId && stripeOnboarded && (
        <TerminalPayment
          open={terminalOpen}
          sessionId={sessionId}
          amount={unpaidDue}
          currency={currency}
          orderLabel={`${tableName} · bill`}
          onClose={() => setTerminalOpen(false)}
          onSuccess={() => {
            setTerminalOpen(false);
            void load().then(() => {
              void settleSession("card_terminal");
            });
          }}
        />
      )}
    </>
  );
}

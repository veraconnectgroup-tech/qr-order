"use client";

import { useCallback, useEffect, useState } from "react";
import { Banknote, CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { TerminalPayment } from "@/components/dashboard/terminal-payment";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { formatPrice } from "@/lib/format";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableName: string;
  sessionId: string | null;
  onPaid?: () => void;
};

export function WaiterTableBillSheet({
  open,
  onOpenChange,
  tableName,
  sessionId,
  onPaid,
}: Props) {
  const { currency, stripeOnboarded, inPersonPaymentLocation } = useDashboard();
  const [loading, setLoading] = useState(false);
  const [settling, setSettling] = useState(false);
  const [bill, setBill] = useState<SessionBill | null>(null);
  const [terminalOpen, setTerminalOpen] = useState(false);

  const unpaidOrders =
    bill?.orders.filter((order) => order.payment_status !== "paid") ?? [];

  const sessionTotal = unpaidOrders.reduce(
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
    void load();
  }, [open, load]);

  async function settleBill(paymentMethod: "at_bar" | "card_terminal") {
    if (!sessionId) return;

    setSettling(true);
    hapticLight();
    try {
      const res = await fetch(`/api/sessions/${sessionId}/bill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_method: paymentMethod }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Could not settle bill");
      }
      hapticSuccess();
      toast.success("Račun naplaćen, sesija zatvorena.");
      onOpenChange(false);
      onPaid?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not settle bill"
      );
    } finally {
      setSettling(false);
    }
  }

  const barLabel =
    inPersonPaymentLocation === "counter"
      ? "Naplati na šanku"
      : inPersonPaymentLocation === "table"
        ? "Naplati za stolom"
        : "Naplati na baru";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="dashboard-theme max-h-[85dvh] overflow-y-auto rounded-t-2xl border-dash-border-subtle bg-dash-bg pb-[env(safe-area-inset-bottom,0px)]"
        >
          <SheetHeader>
            <SheetTitle className="text-left text-dash-text">
              Račun · {tableName}
            </SheetTitle>
          </SheetHeader>

          {!sessionId ? (
            <p className="mt-6 text-sm text-dash-text-muted">
              Nema aktivne sesije za ovaj sto.
            </p>
          ) : loading ? (
            <div className="mt-8 flex justify-center">
              <Loader2 className="size-6 animate-spin text-dash-accent" />
            </div>
          ) : !bill || bill.orders.length === 0 ? (
            <p className="mt-6 text-sm text-dash-text-muted">
              Nema narudžbi na ovoj sesiji.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              <ul className="space-y-3">
                {bill.orders.map((order) => (
                  <li
                    key={order.id}
                    className="rounded-xl border border-dash-border-subtle bg-dash-surface px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-semibold text-dash-text">
                        #{order.order_number}
                      </span>
                      <span
                        className={cn(
                          "text-xs font-medium",
                          order.payment_status === "paid"
                            ? "text-emerald-400"
                            : "text-amber-400"
                        )}
                      >
                        {order.payment_status === "paid" ? "Paid" : "Unpaid"}
                      </span>
                      <span className="font-mono text-sm font-semibold text-dash-accent">
                        {formatPrice(order.total + order.tip_amount, currency)}
                      </span>
                    </div>
                    {order.order_items.length > 0 && (
                      <ul className="mt-2 space-y-0.5 text-xs text-dash-text-muted">
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

              <div className="space-y-1 border-t border-dash-border-subtle pt-4 text-sm text-dash-text-secondary">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-mono">
                    {formatPrice(bill.subtotal, currency)}
                  </span>
                </div>
                {bill.tips > 0 && (
                  <div className="flex justify-between">
                    <span>Tips</span>
                    <span className="font-mono">
                      {formatPrice(bill.tips, currency)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-base font-semibold text-dash-text">
                  <span>Total</span>
                  <span className="font-mono text-dash-accent">
                    {formatPrice(bill.grand_total, currency)}
                  </span>
                </div>
              </div>

              {bill.all_paid ? (
                <p className="text-sm text-emerald-400">
                  Sve narudžbe su plaćene ({bill.paid_count}/{bill.orders.length}
                  ).
                </p>
              ) : (
                <p className="text-sm text-dash-text-muted">
                  {bill.unpaid_count} unpaid ·{" "}
                  {formatPrice(sessionTotal, currency)} due
                </p>
              )}

              <div className="grid gap-2">
                {unpaidOrders.length > 0 && (
                  <Button
                    type="button"
                    disabled={settling}
                    className="min-h-12 w-full bg-dash-accent text-base font-semibold active:scale-[0.98]"
                    onClick={() => void settleBill("at_bar")}
                  >
                    <Banknote className="mr-2 size-5" />
                    {settling ? "Naplata…" : barLabel}
                  </Button>
                )}

                {stripeOnboarded && unpaidOrders.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={settling}
                    className="min-h-12 w-full border-dash-border-subtle text-base font-semibold active:scale-[0.98]"
                    onClick={() => {
                      hapticLight();
                      setTerminalOpen(true);
                    }}
                  >
                    <CreditCard className="mr-2 size-5" />
                    Plati karticom (terminal)
                  </Button>
                )}

                {bill.all_paid && (
                  <Button
                    type="button"
                    disabled={settling}
                    className="min-h-12 w-full bg-emerald-600 text-base font-semibold active:scale-[0.98]"
                    onClick={() => void settleBill("at_bar")}
                  >
                    {settling ? "Zatvaranje…" : "Zatvori sesiju"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {sessionId && stripeOnboarded && (
        <TerminalPayment
          open={terminalOpen}
          sessionId={sessionId}
          amount={sessionTotal}
          currency={currency}
          orderLabel={`${tableName} · sesija`}
          onClose={() => setTerminalOpen(false)}
          onSuccess={() => {
            setTerminalOpen(false);
            void load();
            toast.success("Terminal plaćanje uspješno.");
          }}
        />
      )}
    </>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";
import { hapticLight } from "@/lib/haptics";
import type { Order } from "@/types";

type BillOrder = Pick<
  Order,
  "id" | "order_number" | "total" | "tip_amount" | "payment_status" | "status"
>;

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
  const { locationId, currency, stripeOnboarded } = useDashboard();
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<BillOrder[]>([]);
  const [terminalOpen, setTerminalOpen] = useState(false);

  const unpaidOrders = orders.filter(
    (order) =>
      order.payment_status !== "paid" &&
      order.payment_status !== "pos_online" &&
      !["rejected", "cancelled"].includes(order.status)
  );

  const sessionTotal = unpaidOrders.reduce(
    (sum, order) => sum + Number(order.total) + Number(order.tip_amount ?? 0),
    0
  );

  const load = useCallback(async () => {
    if (!sessionId) {
      setOrders([]);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("orders")
      .select("id, order_number, total, tip_amount, payment_status, status")
      .eq("session_id", sessionId)
      .eq("location_id", locationId)
      .neq("status", "rejected");

    setOrders((data ?? []) as BillOrder[]);
    setLoading(false);
  }, [locationId, sessionId]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

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
          ) : unpaidOrders.length === 0 ? (
            <p className="mt-6 text-sm text-dash-text-muted">
              Sve narudžbe su već plaćene.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              <ul className="space-y-2">
                {unpaidOrders.map((order) => (
                  <li
                    key={order.id}
                    className="flex items-center justify-between text-sm text-dash-text-secondary"
                  >
                    <span className="font-mono font-semibold">
                      #{order.order_number}
                    </span>
                    <span className="font-mono text-dash-accent">
                      {formatPrice(Number(order.total), currency)}
                    </span>
                  </li>
                ))}
              </ul>

              <p className="border-t border-dash-border-subtle pt-4 font-mono text-xl font-bold text-dash-accent">
                Ukupno: {formatPrice(sessionTotal, currency)}
              </p>

              {stripeOnboarded && (
                <Button
                  type="button"
                  className="min-h-12 w-full bg-dash-accent text-base font-semibold hover:bg-dash-accent/90"
                  onClick={() => {
                    hapticLight();
                    setTerminalOpen(true);
                  }}
                >
                  <CreditCard className="mr-2 size-5" />
                  Plati karticom (terminal)
                </Button>
              )}
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
            onOpenChange(false);
            onPaid?.();
            toast.success("Plaćanje uspješno.");
          }}
        />
      )}
    </>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { loadPrinterSetup } from "@/lib/printer/load-printer-setup";
import { printReceiptOrder } from "@/lib/printer/print-receipt-order";
import type { OrderWithDetails } from "@/types";

function isReceiptEligible(order: OrderWithDetails) {
  return order.status === "delivered" || order.payment_status === "paid";
}

export function useReceiptAutoPrint({
  orders,
  orgName,
  currency,
  enabled = true,
}: {
  orders: OrderWithDetails[];
  orgName: string;
  currency: string;
  enabled?: boolean;
}) {
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const eligible = orders.filter(isReceiptEligible);
    const currentIds = new Set(eligible.map((order) => order.id));

    if (!initializedRef.current) {
      seenIdsRef.current = currentIds;
      initializedRef.current = true;
      return;
    }

    const newReceipts = eligible.filter(
      (order) => !seenIdsRef.current.has(order.id)
    );

    if (newReceipts.length === 0) {
      seenIdsRef.current = currentIds;
      return;
    }

    void (async () => {
      const setup = await loadPrinterSetup();
      const autoPrinters = setup.configs.filter(
        (config) =>
          config.auto_print && config.print_for.includes("receipt")
      );

      if (autoPrinters.length === 0) {
        seenIdsRef.current = currentIds;
        return;
      }

      for (const order of newReceipts) {
        await printReceiptOrder(order, orgName, currency, setup, {
          silent: true,
        });
      }

      seenIdsRef.current = currentIds;
    })();
  }, [orders, orgName, currency, enabled]);
}

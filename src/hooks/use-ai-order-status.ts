"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  aiOrderStatusMessageKey,
  isTerminalOrderStatus,
  shouldNotifyStatusChange,
} from "@/lib/ai/status/status-templates";

export type TrackedGuestOrder = {
  id: string;
  order_number: number;
  status: string;
};

const POLL_MS = 15_000;

export function useAiOrderStatus(input: {
  enabled: boolean;
  tableToken: string;
  sessionToken: string | null;
  tUI: (key: string, params?: Record<string, string>) => string;
  onStatusMessage: (message: string) => void;
}) {
  const snapshotRef = useRef<Map<string, string>>(new Map());
  const notifiedRef = useRef<Set<string>>(new Set());

  const poll = useCallback(async () => {
    if (!input.enabled || !input.sessionToken) return;

    try {
      const params = new URLSearchParams({
        sessionToken: input.sessionToken,
      });
      const res = await fetch(
        `/api/tables/${input.tableToken}/orders?${params.toString()}`
      );
      if (!res.ok) return;

      const json = (await res.json()) as {
        data?: { orders?: TrackedGuestOrder[] };
      };
      const orders = json.data?.orders ?? [];

      for (const order of orders) {
        const prev = snapshotRef.current.get(order.id);
        snapshotRef.current.set(order.id, order.status);

        const notifyKey = `${order.id}:${order.status}`;
        if (notifiedRef.current.has(notifyKey)) continue;

        if (!shouldNotifyStatusChange(prev, order.status)) continue;

        const messageKey = aiOrderStatusMessageKey(order.status);
        if (!messageKey) continue;

        notifiedRef.current.add(notifyKey);
        input.onStatusMessage(
          input.tUI(messageKey, {
            number: String(order.order_number),
          })
        );
      }

      for (const [orderId, status] of snapshotRef.current.entries()) {
        if (isTerminalOrderStatus(status)) {
          snapshotRef.current.delete(orderId);
        }
      }
    } catch {
      // non-blocking polling
    }
  }, [input]);

  useEffect(() => {
    if (!input.enabled || !input.sessionToken) {
      snapshotRef.current.clear();
      notifiedRef.current.clear();
      return;
    }

    void poll();
    const id = window.setInterval(() => void poll(), POLL_MS);
    return () => window.clearInterval(id);
  }, [input.enabled, input.sessionToken, input.tableToken, poll]);
}

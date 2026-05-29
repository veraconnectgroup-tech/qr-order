"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProductRecommendation } from "@/components/guest/product-recommendation-card";
import type { AiGuestOrder } from "@/lib/ai/order-context";
import {
  detectDessertTrigger,
  detectPairingTrigger,
  detectSlowKitchenTrigger,
} from "@/lib/ai/proactive-triggers";

export type SmartNudgeKind =
  | "browse_nudge"
  | "drink_pairing"
  | "dessert_nudge"
  | "slow_kitchen";

export type SmartNudge = {
  kind: SmartNudgeKind;
  message: string;
  recommendation?: ProductRecommendation;
  orderId?: string;
};

type UseSmartNudgesOptions = {
  enabled: boolean;
  browseMinutes: number;
  cartItemCount: number;
  hasSessionOrders: boolean;
  hasDrinkInCart: boolean;
  aiChatOpen: boolean;
  orders: AiGuestOrder[];
  messages: {
    browse: string;
    dessert: string;
    slowKitchen: string;
  };
  formatPairingMessage: (rec: ProductRecommendation) => string;
  fetchPairingRecommendation: (prompt: string) => Promise<ProductRecommendation | null>;
  /** When set, proactive triggers are evaluated server-side via Denis sense (M11). */
  fetchServerProactive?: (ctx: {
    dismissedKeys: string[];
  }) => Promise<{
    kind: SmartNudgeKind;
    message: string;
    orderId?: string;
    prompt?: string;
  } | null>;
};

const POLL_MS = 8_000;
const BROWSE_NUDGE_MINUTES = 3;

export function useSmartNudges({
  enabled,
  browseMinutes,
  cartItemCount,
  hasSessionOrders,
  hasDrinkInCart,
  aiChatOpen,
  orders,
  messages,
  formatPairingMessage,
  fetchPairingRecommendation,
  fetchServerProactive,
}: UseSmartNudgesOptions) {
  const [activeNudge, setActiveNudge] = useState<SmartNudge | null>(null);
  const [tick, setTick] = useState(0);
  const dismissedRef = useRef<Set<string>>(new Set());
  const pairingFetchedRef = useRef<Set<string>>(new Set());

  const isDismissed = useCallback((key: string) => {
    return dismissedRef.current.has(key);
  }, []);

  const dismiss = useCallback(() => {
    if (!activeNudge) return;
    if (activeNudge.kind === "drink_pairing" && activeNudge.orderId) {
      dismissedRef.current.add(`drink_pairing:${activeNudge.orderId}`);
    } else if (activeNudge.kind === "slow_kitchen" && activeNudge.orderId) {
      dismissedRef.current.add(`slow_kitchen:${activeNudge.orderId}`);
    } else {
      dismissedRef.current.add(activeNudge.kind);
    }
    setActiveNudge(null);
  }, [activeNudge]);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setTick((value) => value + 1), POLL_MS);
    return () => window.clearInterval(id);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || aiChatOpen || activeNudge) return;

    if (fetchServerProactive) {
      const dismissedKeys = [...dismissedRef.current];
      void fetchServerProactive({ dismissedKeys }).then((nudge) => {
        if (!nudge) return;
        if (nudge.kind === "drink_pairing" && nudge.orderId) {
          if (
            isDismissed(`drink_pairing:${nudge.orderId}`) ||
            isDismissed("drink_pairing") ||
            pairingFetchedRef.current.has(nudge.orderId)
          ) {
            return;
          }
          if (!nudge.prompt) return;
          pairingFetchedRef.current.add(nudge.orderId);
          void fetchPairingRecommendation(nudge.prompt).then((rec) => {
            if (
              !rec ||
              isDismissed(`drink_pairing:${nudge.orderId}`) ||
              isDismissed("drink_pairing")
            ) {
              return;
            }
            setActiveNudge((current) => {
              if (current) return current;
              return {
                kind: "drink_pairing",
                message: formatPairingMessage(rec),
                recommendation: rec,
                orderId: nudge.orderId,
              };
            });
          });
          return;
        }

        const dismissKey =
          nudge.kind === "slow_kitchen" && nudge.orderId
            ? `slow_kitchen:${nudge.orderId}`
            : nudge.kind === "drink_pairing" && nudge.orderId
              ? `drink_pairing:${nudge.orderId}`
              : nudge.kind;
        if (isDismissed(dismissKey)) return;

        dismissedRef.current.add(dismissKey);

        setActiveNudge((current) => {
          if (current) return current;
          return {
            kind: nudge.kind,
            message: nudge.message,
            orderId: nudge.orderId,
          };
        });
      });
      return;
    }

    const hasOrdered = cartItemCount > 0 || hasSessionOrders;

    if (
      !isDismissed("browse_nudge") &&
      browseMinutes >= BROWSE_NUDGE_MINUTES &&
      !hasOrdered
    ) {
      setActiveNudge({ kind: "browse_nudge", message: messages.browse });
      return;
    }

    if (!hasDrinkInCart) {
      const pairing = detectPairingTrigger(orders, (orderId) =>
        isDismissed(`drink_pairing:${orderId}`)
      );
      if (pairing?.orderId && !pairingFetchedRef.current.has(pairing.orderId)) {
        pairingFetchedRef.current.add(pairing.orderId);
        void fetchPairingRecommendation(pairing.prompt).then((rec) => {
          if (
            !rec ||
            isDismissed(`drink_pairing:${pairing.orderId}`) ||
            isDismissed("drink_pairing")
          ) {
            return;
          }
          setActiveNudge((current) => {
            if (current) return current;
            return {
              kind: "drink_pairing",
              message: formatPairingMessage(rec),
              recommendation: rec,
              orderId: pairing.orderId,
            };
          });
        });
      }
    }

    if (!isDismissed("dessert_nudge")) {
      const dessert = detectDessertTrigger(orders, () =>
        isDismissed("dessert_nudge")
      );
      if (dessert) {
        setActiveNudge({ kind: "dessert_nudge", message: messages.dessert });
        return;
      }
    }

    if (!isDismissed("slow_kitchen")) {
      const slow = detectSlowKitchenTrigger(orders, (orderId) =>
        isDismissed(`slow_kitchen:${orderId}`)
      );
      if (slow?.orderId) {
        setActiveNudge({
          kind: "slow_kitchen",
          message: messages.slowKitchen,
          orderId: slow.orderId,
        });
      }
    }
  }, [
    enabled,
    aiChatOpen,
    activeNudge,
    browseMinutes,
    cartItemCount,
    hasSessionOrders,
    hasDrinkInCart,
    orders,
    tick,
    isDismissed,
    messages,
    formatPairingMessage,
    fetchPairingRecommendation,
    fetchServerProactive,
  ]);

  return { activeNudge, dismiss };
}

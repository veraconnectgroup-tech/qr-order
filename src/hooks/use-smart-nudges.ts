"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProductRecommendation } from "@/components/guest/product-recommendation-card";
import type { AiGuestOrder } from "@/lib/ai/order-context";
import {
  detectDessertTrigger,
  detectPairingTrigger,
  detectSlowKitchenTrigger,
} from "@/lib/ai/proactive-triggers";
import {
  buildNudgeClickThroughEvent,
  canShowClientNudge,
  CATEGORY_NUDGE_ITEM_THRESHOLD,
  CART_NUDGE_MINUTES,
  deriveClientNudgeBudget,
  resolveNudgeMessage,
  scrollSignalToNudgeKind,
  TIMED_NUDGE_MINUTES,
  type ScrollIntentKind,
  type SmartNudgeKind,
} from "@/lib/guest/scroll-intelligence";

export type { SmartNudgeKind };

export type SmartNudge = {
  kind: SmartNudgeKind;
  message: string;
  recommendation?: ProductRecommendation;
  orderId?: string;
  variant?: "A" | "B";
};

type UseSmartNudgesOptions = {
  enabled: boolean;
  sessionKey: string;
  browseMinutes: number;
  cartItemCount: number;
  hasSessionOrders: boolean;
  hasDrinkInCart: boolean;
  aiChatOpen: boolean;
  orders: AiGuestOrder[];
  latestScrollIntent?: ScrollIntentKind | null;
  categoryViewCounts?: Record<string, number>;
  categoryLabels?: Record<string, string>;
  messages: {
    browse: string;
    dessert: string;
    slowKitchen: string;
  };
  formatPairingMessage: (rec: ProductRecommendation) => string;
  fetchPairingRecommendation: (prompt: string) => Promise<ProductRecommendation | null>;
  onNudgeTelemetry?: (event: ReturnType<typeof buildNudgeClickThroughEvent>) => void;
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

export function useSmartNudges({
  enabled,
  sessionKey,
  browseMinutes,
  cartItemCount,
  hasSessionOrders,
  hasDrinkInCart,
  aiChatOpen,
  orders,
  latestScrollIntent,
  categoryViewCounts = {},
  categoryLabels = {},
  messages,
  formatPairingMessage,
  fetchPairingRecommendation,
  onNudgeTelemetry,
  fetchServerProactive,
}: UseSmartNudgesOptions) {
  const [activeNudge, setActiveNudge] = useState<SmartNudge | null>(null);
  const [tick, setTick] = useState(0);
  const dismissedRef = useRef<Set<string>>(new Set());
  const shownRef = useRef(0);
  const pairingFetchedRef = useRef<Set<string>>(new Set());
  const cartFirstAddAtRef = useRef<number | null>(null);
  const exitIntentShownRef = useRef(false);

  const budget = deriveClientNudgeBudget({
    shown: shownRef.current,
    dismissed: dismissedRef.current.size,
  });

  const isDismissed = useCallback((key: string) => {
    return dismissedRef.current.has(key);
  }, []);

  const showNudge = useCallback(
    (input: {
      kind: SmartNudgeKind;
      dismissKey: string;
      message?: string;
      categoryLabel?: string;
      recommendation?: ProductRecommendation;
      orderId?: string;
    }) => {
      if (
        !canShowClientNudge({
          budget: deriveClientNudgeBudget({
            shown: shownRef.current,
            dismissed: dismissedRef.current.size,
          }),
          dismissKey: input.dismissKey,
          dismissedKeys: dismissedRef.current,
        })
      ) {
        return false;
      }

      const resolved = resolveNudgeMessage({
        kind: input.kind,
        sessionKey,
        override: input.message,
        categoryLabel: input.categoryLabel,
      });

      shownRef.current += 1;
      setActiveNudge({
        kind: input.kind,
        message: resolved.message,
        recommendation: input.recommendation,
        orderId: input.orderId,
        variant: resolved.variant,
      });
      onNudgeTelemetry?.(
        buildNudgeClickThroughEvent({
          kind: input.kind,
          variant: resolved.variant,
          action: "shown",
        })
      );
      return true;
    },
    [onNudgeTelemetry, sessionKey]
  );

  const dismiss = useCallback(() => {
    if (!activeNudge) return;

    if (activeNudge.kind === "drink_pairing" && activeNudge.orderId) {
      dismissedRef.current.add(`drink_pairing:${activeNudge.orderId}`);
    } else if (activeNudge.kind === "slow_kitchen" && activeNudge.orderId) {
      dismissedRef.current.add(`slow_kitchen:${activeNudge.orderId}`);
    } else {
      dismissedRef.current.add(activeNudge.kind);
    }

    onNudgeTelemetry?.(
      buildNudgeClickThroughEvent({
        kind: activeNudge.kind,
        variant: activeNudge.variant ?? "A",
        action: "dismiss",
      })
    );
    setActiveNudge(null);
  }, [activeNudge, onNudgeTelemetry]);

  const accept = useCallback(() => {
    if (!activeNudge) return;
    onNudgeTelemetry?.(
      buildNudgeClickThroughEvent({
        kind: activeNudge.kind,
        variant: activeNudge.variant ?? "A",
        action: "click",
      })
    );
  }, [activeNudge, onNudgeTelemetry]);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setTick((value) => value + 1), POLL_MS);
    return () => window.clearInterval(id);
  }, [enabled]);

  useEffect(() => {
    if (cartItemCount > 0 && cartFirstAddAtRef.current == null) {
      cartFirstAddAtRef.current = Date.now();
    }
    if (cartItemCount === 0) {
      cartFirstAddAtRef.current = null;
    }
  }, [cartItemCount]);

  useEffect(() => {
    if (!enabled || aiChatOpen) return;

    const onPopState = () => {
      if (exitIntentShownRef.current || cartItemCount === 0) return;
      exitIntentShownRef.current = true;
      showNudge({
        kind: "exit_intent",
        dismissKey: "exit_intent",
      });
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [enabled, aiChatOpen, cartItemCount, showNudge]);

  useEffect(() => {
    if (!enabled || aiChatOpen || activeNudge || budget.stopped) return;

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
            showNudge({
              kind: "drink_pairing",
              dismissKey: `drink_pairing:${nudge.orderId}`,
              message: formatPairingMessage(rec),
              recommendation: rec,
              orderId: nudge.orderId,
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

        showNudge({
          kind: nudge.kind,
          dismissKey,
          message: nudge.message,
          orderId: nudge.orderId,
        });
      });
      return;
    }

    const hasOrdered = cartItemCount > 0 || hasSessionOrders;

    if (latestScrollIntent) {
      const scrollKind = scrollSignalToNudgeKind(latestScrollIntent);
      if (
        !isDismissed(scrollKind) &&
        showNudge({
          kind: scrollKind,
          dismissKey: scrollKind,
        })
      ) {
        return;
      }
    }

    for (const [categoryId, count] of Object.entries(categoryViewCounts)) {
      if (count < CATEGORY_NUDGE_ITEM_THRESHOLD) continue;
      if (isDismissed(`category_nudge:${categoryId}`)) continue;
      if (
        showNudge({
          kind: "category_nudge",
          dismissKey: `category_nudge:${categoryId}`,
          categoryLabel: categoryLabels[categoryId],
        })
      ) {
        return;
      }
    }

    if (
      cartItemCount > 0 &&
      cartFirstAddAtRef.current != null &&
      !isDismissed("cart_nudge")
    ) {
      const cartMinutes = Math.floor(
        (Date.now() - cartFirstAddAtRef.current) / 60_000
      );
      if (
        cartMinutes >= CART_NUDGE_MINUTES &&
        showNudge({ kind: "cart_nudge", dismissKey: "cart_nudge" })
      ) {
        return;
      }
    }

    if (
      !isDismissed("timed_nudge") &&
      !isDismissed("browse_nudge") &&
      browseMinutes >= TIMED_NUDGE_MINUTES &&
      !hasOrdered &&
      showNudge({
        kind: "timed_nudge",
        dismissKey: "timed_nudge",
        message: messages.browse,
      })
    ) {
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
          showNudge({
            kind: "drink_pairing",
            dismissKey: `drink_pairing:${pairing.orderId}`,
            message: formatPairingMessage(rec),
            recommendation: rec,
            orderId: pairing.orderId,
          });
        });
      }
    }

    if (!isDismissed("dessert_nudge")) {
      const dessert = detectDessertTrigger(orders, () =>
        isDismissed("dessert_nudge")
      );
      if (
        dessert &&
        showNudge({
          kind: "dessert_nudge",
          dismissKey: "dessert_nudge",
          message: messages.dessert,
        })
      ) {
        return;
      }
    }

    if (!isDismissed("slow_kitchen")) {
      const slow = detectSlowKitchenTrigger(orders, (orderId) =>
        isDismissed(`slow_kitchen:${orderId}`)
      );
      if (slow?.orderId) {
        showNudge({
          kind: "slow_kitchen",
          dismissKey: `slow_kitchen:${slow.orderId}`,
          message: messages.slowKitchen,
          orderId: slow.orderId,
        });
      }
    }
  }, [
    enabled,
    aiChatOpen,
    activeNudge,
    budget.stopped,
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
    latestScrollIntent,
    categoryViewCounts,
    categoryLabels,
    showNudge,
  ]);

  return { activeNudge, dismiss, accept, nudgeBudget: budget };
}

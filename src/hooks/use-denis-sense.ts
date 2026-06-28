"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CartItem } from "@/hooks/use-cart";
import {
  analyzeFullCartAbandon,
  DISTRACTION_DELAY_SEC,
} from "@/lib/denis/cognition/offer/smart-cart-recovery";
import {
  countAddRemoveCycles,
  scoreAbandonmentRisk,
} from "@/lib/denis/cognition/offer/abandonment-risk-scorer";
import {
  resolvePreventionIntervention,
  type PreventionInterventionKind,
} from "@/lib/denis/cognition/offer/preventive-intervention";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import {
  buildManualCartSnapshot,
  deriveCartAwarenessNudge,
  FULL_CART_RECOVERY_MS,
  manualCartRevision,
  type CartAwarenessNudge,
} from "@/lib/guest/manual-cart-snapshot";
import {
  postDenisSense,
  type DenisSenseProactiveNudge,
  type DenisSenseResponse,
} from "@/lib/guest/denis-sense-client";

export type { CartAwarenessNudge };

type UseDenisSenseOptions = {
  enabled: boolean;
  locationId: string;
  tableId: string;
  sessionToken: string | null;
  aiSessionId: string | null;
  deviceFingerprint: string | null;
  cartItems: CartItem[];
  cartBump: number;
  removedProductIds?: string[];
  lastCartChangeAt?: number;
  manualCartEnabled?: boolean;
  language?: string;
  viewedCheckout?: boolean;
  guestAvgSpendCents?: number | null;
  cheaperAlternative?: {
    productId: string;
    productName: string;
    priceCents: number;
  } | null;
  popularProduct?: { productId: string; productName: string } | null;
  venueAvgSessionIdleSec?: number | null;
  onSenseResponse?: (response: DenisSenseResponse) => void;
};

export const DEBOUNCE_MS = 600;

function mapProactiveToAwareness(
  nudge: DenisSenseProactiveNudge
): CartAwarenessNudge | null {
  if (!nudge.message?.trim()) return null;
  return {
    kind:
      nudge.kind === "drink_pairing"
        ? "drink_pairing"
        : nudge.kind === "browse_nudge"
          ? "ready_to_order"
          : nudge.kind === "cart_abandonment_prevention"
            ? "cart_abandonment_prevention"
          : "cart_recovery",
    message: nudge.message,
    dismissKey: `sense:${nudge.kind}:${nudge.orderId ?? nudge.prompt ?? "generic"}`,
  };
}

/** Debounced manual cart sync + local Denis cart awareness (M11). */
export function useDenisSense({
  enabled,
  locationId,
  tableId,
  sessionToken,
  aiSessionId,
  deviceFingerprint,
  cartItems,
  cartBump,
  removedProductIds = [],
  lastCartChangeAt = 0,
  manualCartEnabled = true,
  language = "sr",
  viewedCheckout = false,
  guestAvgSpendCents = null,
  cheaperAlternative = null,
  popularProduct = null,
  venueAvgSessionIdleSec = null,
  onSenseResponse,
}: UseDenisSenseOptions) {
  const lastRevisionRef = useRef<number | null>(null);
  const dismissedRef = useRef(new Set<string>());
  const lastSyncedAtRef = useRef<number | null>(null);
  const mutationLogRef = useRef<Array<"add" | "remove">>([]);
  const prevRemovedCountRef = useRef(0);
  const prevItemCountRef = useRef(0);
  const preventionAttemptsRef = useRef(0);
  const usedPreventionKindsRef = useRef<PreventionInterventionKind[]>([]);
  const preventionIgnoredRef = useRef(false);
  const [awarenessNudge, setAwarenessNudge] = useState<CartAwarenessNudge | null>(
    null
  );
  const [conflictPrompt, setConflictPrompt] = useState<string | null>(null);
  const [partyDeviceCount, setPartyDeviceCount] = useState(0);
  const [sharedAiSessionId, setSharedAiSessionId] = useState<string | null>(null);

  const dismissAwarenessNudge = useCallback(() => {
    setAwarenessNudge((current) => {
      if (current?.dismissKey) {
        dismissedRef.current.add(current.dismissKey);
        if (current.kind === "cart_abandonment_prevention") {
          preventionIgnoredRef.current = true;
        }
      }
      return null;
    });
  }, []);

  useEffect(() => {
    const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const removedCount = removedProductIds.length;

    if (removedCount > prevRemovedCountRef.current) {
      mutationLogRef.current.push("remove");
    } else if (itemCount > prevItemCountRef.current) {
      mutationLogRef.current.push("add");
    }

    prevRemovedCountRef.current = removedCount;
    prevItemCountRef.current = itemCount;
  }, [cartItems, removedProductIds]);

  useEffect(() => {
    if (!enabled || !sessionToken || !aiSessionId || !manualCartEnabled) {
      return;
    }
    if (!deviceFingerprint) return;

    const revision = manualCartRevision(cartItems, cartBump);
    if (lastRevisionRef.current === revision) return;

    const timeoutId = window.setTimeout(() => {
      lastRevisionRef.current = revision;
      const snapshot = buildManualCartSnapshot(cartItems, revision);

      void postDenisSense({
        locationId,
        tableId,
        sessionToken,
        aiSessionId,
        deviceFingerprint,
        channel: "telemetry.manual_cart",
        manualCartSnapshot: snapshot,
      }).then((response) => {
        if (!response) return;

        lastSyncedAtRef.current = Date.now();
        onSenseResponse?.(response);

        if (response.conflictPrompt) {
          setConflictPrompt(response.conflictPrompt);
        }

        setPartyDeviceCount(response.partyDeviceCount ?? 0);
        setSharedAiSessionId(response.sharedAiSessionId ?? null);

        if (response.proactiveNudge) {
          const mapped = mapProactiveToAwareness(response.proactiveNudge);
          if (mapped && !dismissedRef.current.has(mapped.dismissKey)) {
            setAwarenessNudge(mapped);
          }
        }
      });
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [
    enabled,
    locationId,
    tableId,
    sessionToken,
    aiSessionId,
    deviceFingerprint,
    cartItems,
    cartBump,
    manualCartEnabled,
    onSenseResponse,
  ]);

  useEffect(() => {
    if (!enabled || cartItems.length === 0) {
      setAwarenessNudge(null);
      return;
    }

    const snapshot = buildManualCartSnapshot(
      cartItems,
      manualCartRevision(cartItems, cartBump)
    );
    const idleMs =
      lastCartChangeAt > 0 ? Math.max(0, Date.now() - lastCartChangeAt) : 0;

    const local = deriveCartAwarenessNudge({
      snapshot,
      removedProductIds,
      idleMs,
      dismissedKeys: dismissedRef.current,
      language,
    });

    if (local) {
      setAwarenessNudge(local);
    }
  }, [
    enabled,
    cartItems,
    cartBump,
    removedProductIds,
    lastCartChangeAt,
    language,
  ]);

  useEffect(() => {
    if (!enabled || cartItems.length === 0) return;

    const checkPrevention = () => {
      const idleMs =
        lastCartChangeAt > 0 ? Math.max(0, Date.now() - lastCartChangeAt) : 0;
      const snapshot = buildManualCartSnapshot(
        cartItems,
        manualCartRevision(cartItems, cartBump)
      );
      const subtotalCents = Math.round((snapshot.subtotal ?? 0) * 100);
      const primaryItem = snapshot.items[0];

      const risk = scoreAbandonmentRisk({
        cartIdleMs: idleMs,
        lastInteractionMs: idleMs,
        viewedCheckout,
        cartSubtotalCents: subtotalCents,
        guestAvgSpendCents,
        removedItemCount: removedProductIds.length,
        addRemoveCycleCount: countAddRemoveCycles(mutationLogRef.current),
        itemCount: snapshot.itemCount ?? snapshot.items.length,
      });

      const resolution = resolvePreventionIntervention({
        risk,
        lastInteractionMs: idleMs,
        venueAvgSessionIdleSec,
        preventionAttemptCount: preventionAttemptsRef.current,
        usedInterventionKinds: usedPreventionKindsRef.current,
        preventionIgnored: preventionIgnoredRef.current,
        respectDecline: true,
        addRemoveCycleCount: countAddRemoveCycles(mutationLogRef.current),
        language,
        primaryCartItem: primaryItem
          ? {
              productId: primaryItem.productId,
              productName: primaryItem.productName,
            }
          : null,
        cheaperAlternative,
        popularProduct,
      });

      const intervention = resolution.intervention;
      if (!intervention) return;
      if (dismissedRef.current.has(intervention.dismissKey)) return;

      preventionAttemptsRef.current += 1;
      usedPreventionKindsRef.current.push(intervention.kind);

      setAwarenessNudge({
        kind: "cart_abandonment_prevention",
        message: intervention.message,
        dismissKey: intervention.dismissKey,
        productId: intervention.productId ?? undefined,
        productName: intervention.productName ?? undefined,
      });
    };

    const intervalId = window.setInterval(checkPrevention, 15_000);
    checkPrevention();
    return () => window.clearInterval(intervalId);
  }, [
    enabled,
    cartItems,
    cartBump,
    lastCartChangeAt,
    viewedCheckout,
    guestAvgSpendCents,
    cheaperAlternative,
    popularProduct,
    venueAvgSessionIdleSec,
    removedProductIds.length,
    language,
  ]);

  useEffect(() => {
    if (!enabled || cartItems.length === 0) return;

    const checkRecovery = () => {
      const idleMs =
        lastCartChangeAt > 0 ? Math.max(0, Date.now() - lastCartChangeAt) : 0;
      if (idleMs < FULL_CART_RECOVERY_MS) return;

      const snapshot = buildManualCartSnapshot(
        cartItems,
        manualCartRevision(cartItems, cartBump)
      );

      const plan = analyzeFullCartAbandon({
        itemCount: snapshot.itemCount ?? 0,
        subtotal: snapshot.subtotal ?? 0,
        idleMs,
        viewedCheckout,
        mental: emptyGuestMentalModel(),
        language,
      });

      if (plan.action === "skip" || !plan.message) return;

      const dismissKey = `cart_sense:recovery:${plan.reason}`;
      if (dismissedRef.current.has(dismissKey)) return;
      if (
        plan.delaySeconds > 0 &&
        idleMs / 1000 < plan.delaySeconds &&
        plan.reason !== "distraction"
      ) {
        return;
      }

      setAwarenessNudge({
        kind: "cart_recovery",
        message: plan.message,
        dismissKey,
      });
    };

    const intervalId = window.setInterval(checkRecovery, 30_000);
    checkRecovery();
    return () => window.clearInterval(intervalId);
  }, [
    enabled,
    cartItems,
    cartBump,
    lastCartChangeAt,
    viewedCheckout,
    language,
  ]);

  return {
    awarenessNudge,
    dismissAwarenessNudge,
    conflictPrompt,
    lastSyncedAt: lastSyncedAtRef.current,
    partyDeviceCount,
    sharedAiSessionId,
    distractionDelaySec: DISTRACTION_DELAY_SEC,
  };
}

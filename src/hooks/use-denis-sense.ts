"use client";

import { useEffect, useRef } from "react";
import type { CartItem } from "@/hooks/use-cart";
import {
  buildManualCartSnapshot,
  manualCartRevision,
} from "@/lib/guest/manual-cart-snapshot";
import { postDenisSense } from "@/lib/guest/denis-sense-client";

type UseDenisSenseOptions = {
  enabled: boolean;
  locationId: string;
  tableId: string;
  sessionToken: string | null;
  aiSessionId: string | null;
  deviceFingerprint: string | null;
  cartItems: CartItem[];
  cartBump: number;
  manualCartEnabled?: boolean;
};

const DEBOUNCE_MS = 600;

/** Debounced manual cart sync to Denis sense API (M11). */
export function useDenisSense({
  enabled,
  locationId,
  tableId,
  sessionToken,
  aiSessionId,
  deviceFingerprint,
  cartItems,
  cartBump,
  manualCartEnabled = true,
}: UseDenisSenseOptions) {
  const lastRevisionRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !sessionToken || !aiSessionId || !manualCartEnabled) {
      return;
    }
    if (!deviceFingerprint) return;

    const revision = manualCartRevision(cartItems, cartBump);
    if (lastRevisionRef.current === revision) return;

    const timeoutId = window.setTimeout(() => {
      lastRevisionRef.current = revision;
      void postDenisSense({
        locationId,
        tableId,
        sessionToken,
        aiSessionId,
        deviceFingerprint,
        channel: "telemetry.manual_cart",
        manualCartSnapshot: buildManualCartSnapshot(cartItems, revision),
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
  ]);
}

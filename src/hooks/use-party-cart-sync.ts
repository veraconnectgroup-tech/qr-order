"use client";

import { useCallback, useEffect, useRef } from "react";
import { useCart, type CartItem } from "@/hooks/use-cart";
import type { RealtimeMode } from "@/hooks/use-postgres-realtime";
import { usePostgresRealtime } from "@/hooks/use-postgres-realtime";
import {
  mergePeerCartIntoLocal,
  peerCartRevisionChanged,
} from "@/lib/guest/apply-peer-cart-snapshot";
import { fetchPartyCart } from "@/lib/guest/party-cart-client";
import { PARTY_CART_SYNC_POLL_MS } from "@/lib/constants";

type UsePartyCartSyncOptions = {
  enabled: boolean;
  partyMode: "shared_cart" | "per_device";
  tableToken: string;
  sessionToken: string | null;
  tableSessionId: string | null;
  deviceFingerprint: string;
  viewRevision?: number | null;
  sseConnected?: boolean;
};

/** Shared table cart sync — Denis view SSE + party cart API + Realtime fallback. */
export function usePartyCartSync({
  enabled,
  partyMode,
  tableToken,
  sessionToken,
  tableSessionId,
  deviceFingerprint,
  viewRevision = null,
  sseConnected = false,
}: UsePartyCartSyncOptions): RealtimeMode {
  const replaceItems = useCart((state) => state.replaceItems);
  const lastMergedRevisionRef = useRef<number | null>(null);
  const lastViewRevisionRef = useRef<number | null>(null);

  const syncPeerCart = useCallback(async () => {
    if (
      !enabled ||
      partyMode !== "shared_cart" ||
      !sessionToken ||
      !deviceFingerprint
    ) {
      return;
    }

    const payload = await fetchPartyCart(tableToken, sessionToken);
    if (!payload || payload.partyMode !== "shared_cart") return;

    if (
      !peerCartRevisionChanged(
        lastMergedRevisionRef.current,
        payload.mergedRevision
      ) &&
      lastMergedRevisionRef.current != null
    ) {
      return;
    }

    lastMergedRevisionRef.current = payload.mergedRevision;

    const merged = mergePeerCartIntoLocal(
      useCart.getState().items,
      payload.devices.map((device) => ({
        deviceFingerprint: device.deviceFingerprint,
        snapshot: device.snapshot,
      })),
      deviceFingerprint
    );

    const currentItems = useCart.getState().items;
    if (JSON.stringify(currentItems) === JSON.stringify(merged)) {
      return;
    }

    replaceItems(merged);
  }, [
    deviceFingerprint,
    enabled,
    partyMode,
    replaceItems,
    sessionToken,
    tableToken,
  ]);

  useEffect(() => {
    if (!enabled || partyMode !== "shared_cart") return;
    if (viewRevision == null) return;
    if (lastViewRevisionRef.current === viewRevision) return;
    lastViewRevisionRef.current = viewRevision;
    void syncPeerCart();
  }, [enabled, partyMode, syncPeerCart, viewRevision]);

  useEffect(() => {
    if (!enabled || partyMode !== "shared_cart" || sseConnected) return;

    const id = window.setInterval(() => void syncPeerCart(), PARTY_CART_SYNC_POLL_MS);
    return () => window.clearInterval(id);
  }, [enabled, partyMode, sseConnected, syncPeerCart]);

  const realtimeMode = usePostgresRealtime({
    channelName: `party-cart:${tableSessionId ?? "none"}`,
    table: "denis_party_devices",
    tableSessionId: tableSessionId ?? undefined,
    filter: tableSessionId ? `table_session_id=eq.${tableSessionId}` : "",
    onChange: syncPeerCart,
    enabled:
      enabled &&
      partyMode === "shared_cart" &&
      Boolean(tableSessionId),
    fallbackPollMs: PARTY_CART_SYNC_POLL_MS,
  });

  return sseConnected ? "live" : realtimeMode;
}

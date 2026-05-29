"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { subscribePosChannel } from "@/lib/pos/provisional-broadcast";
import { isPosKitchenProvisionalEnabled } from "@/lib/pos/feature-flags";
import {
  applyPosBroadcastEvent,
  createProvisionalMap,
  listActiveProvisionals,
  pruneExpiredProvisionals,
  countTimedOutProvisionals,
  type ProvisionalEntry,
  type ProvisionalMap,
} from "@/lib/pos/provisional-merge";
import { PROVISIONAL_KITCHEN_TIMEOUT_MS } from "@/lib/pos/provisional-types";
import type { PosBroadcastEvent } from "@/lib/pos/provisional-types";

export function useProvisionalPosOrders(locationId: string) {
  const enabled = Boolean(
    locationId && isPosKitchenProvisionalEnabled(locationId)
  );
  const [map, setMap] = useState<ProvisionalMap>(() => createProvisionalMap());
  const [syncFailedCount, setSyncFailedCount] = useState(0);

  const applyEvent = useCallback((event: PosBroadcastEvent) => {
    setMap((prev) => applyPosBroadcastEvent(prev, event));
  }, []);

  useEffect(() => {
    if (!enabled || !locationId) return;
    return subscribePosChannel(locationId, applyEvent);
  }, [enabled, locationId, applyEvent]);

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      setMap((prev) => {
        const timedOut = countTimedOutProvisionals(prev);
        setSyncFailedCount(timedOut);
        return pruneExpiredProvisionals(prev);
      });
    };

    tick();
    const id = window.setInterval(tick, 1_000);
    return () => window.clearInterval(id);
  }, [enabled]);

  const entries: ProvisionalEntry[] = useMemo(
    () =>
      enabled
        ? listActiveProvisionals(map)
        : [],
    [enabled, map]
  );

  return {
    enabled,
    entries,
    syncFailedCount,
    timeoutMs: PROVISIONAL_KITCHEN_TIMEOUT_MS,
  };
}

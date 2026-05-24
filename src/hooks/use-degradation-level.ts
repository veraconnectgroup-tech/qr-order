"use client";

import { useEffect, useMemo, useState } from "react";
import {
  computeDegradationLevel,
  getDegradationInfo,
  parseHealthForDegradation,
  type DegradationInfo,
  type HealthSummary,
} from "@/lib/degradation/status";
import { useConnectionStatus } from "@/hooks/use-connection-status";
import type { RealtimeMode } from "@/hooks/use-postgres-realtime";

type UseDegradationLevelOptions = {
  realtimeMode?: RealtimeMode;
  fetchFailed?: boolean;
};

export function useDegradationLevel(options?: UseDegradationLevelOptions) {
  const { status: connectionStatus } = useConnectionStatus();
  const [health, setHealth] = useState<HealthSummary | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHealth() {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as HealthSummary;
        if (!cancelled) setHealth(json);
      } catch {
        if (!cancelled) setHealth(null);
      }
    }

    void loadHealth();
    const id = setInterval(() => void loadHealth(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [connectionStatus]);

  const parsed = parseHealthForDegradation(health);

  const level = computeDegradationLevel({
    connectionStatus,
    healthStatus: parsed.healthStatus,
    redisDown: parsed.redisDown,
    stripeCircuitOpen: parsed.stripeCircuitOpen,
    fiskalyCircuitOpen: parsed.fiskalyCircuitOpen,
    realtimeMode: options?.realtimeMode,
    fetchFailed: options?.fetchFailed,
  });

  const info: DegradationInfo = useMemo(
    () => getDegradationInfo(level),
    [level]
  );

  return { level, info, connectionStatus, health };
}

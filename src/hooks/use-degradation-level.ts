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
import type { DegradationLevel as DenisDegradationLevel } from "@/lib/denis/config/degradation-ladder";

type DenisDegradationPayload = {
  level: DenisDegradationLevel;
  staffMessage: string;
  reason: string;
  disabledFeatures: string[];
  circuits?: {
    openai?: string;
    fiskaly?: string;
    stripe?: string;
  };
};

type UseDegradationLevelOptions = {
  realtimeMode?: RealtimeMode;
  fetchFailed?: boolean;
  locationId?: string;
  denisEnabled?: boolean;
};

export function useDegradationLevel(options?: UseDegradationLevelOptions) {
  const { status: connectionStatus } = useConnectionStatus();
  const [health, setHealth] = useState<HealthSummary | null>(null);
  const [denis, setDenis] = useState<DenisDegradationPayload | null>(null);

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

  useEffect(() => {
    if (!options?.denisEnabled || !options.locationId) {
      setDenis(null);
      return;
    }

    let cancelled = false;

    async function loadDenisDegradation() {
      try {
        const res = await fetch("/api/dashboard/denis-degradation", {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { data?: DenisDegradationPayload };
        if (!cancelled && json.data) setDenis(json.data);
      } catch {
        if (!cancelled) setDenis(null);
      }
    }

    void loadDenisDegradation();
    const id = setInterval(() => void loadDenisDegradation(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [connectionStatus, options?.denisEnabled, options?.locationId]);

  const parsed = parseHealthForDegradation(health);

  const platformLevel = computeDegradationLevel({
    connectionStatus,
    healthStatus: parsed.healthStatus,
    redisDown: parsed.redisDown,
    stripeCircuitOpen: parsed.stripeCircuitOpen,
    fiskalyCircuitOpen: parsed.fiskalyCircuitOpen,
    realtimeMode: options?.realtimeMode,
    fetchFailed: options?.fetchFailed,
  });

  const platformInfo: DegradationInfo = useMemo(
    () => getDegradationInfo(platformLevel),
    [platformLevel]
  );

  return {
    platformLevel,
    platformInfo,
    denisLevel: denis?.level ?? "full",
    denisStaffMessage: denis?.staffMessage ?? null,
    denisReason: denis?.reason ?? null,
    denisDisabledFeatures: denis?.disabledFeatures ?? [],
    circuits: denis?.circuits ?? {
      openai: health?.circuits?.openai,
      fiskaly: health?.circuits?.fiskaly,
      stripe: health?.circuits?.stripe,
    },
    connectionStatus,
    health,
  };
}

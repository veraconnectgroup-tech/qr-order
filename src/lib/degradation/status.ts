import type { ConnectionStatus } from "@/hooks/use-connection-status";
import type { RealtimeMode } from "@/hooks/use-postgres-realtime";

/** Graceful degradation ladder (Level 6 = DB down / full offline cache — v2, not implemented). */
export type DegradationLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type DegradationInput = {
  connectionStatus: ConnectionStatus;
  healthStatus?: "healthy" | "degraded" | "unhealthy" | null;
  redisDown?: boolean;
  stripeCircuitOpen?: boolean;
  fiskalyCircuitOpen?: boolean;
  realtimeMode?: RealtimeMode;
  fetchFailed?: boolean;
};

export type DegradationInfo = {
  level: DegradationLevel;
  label: string;
  description: string;
};

const LEVEL_INFO: Record<DegradationLevel, Omit<DegradationInfo, "level">> = {
  0: {
    label: "Normal",
    description: "Alle Systeme funktionieren.",
  },
  1: {
    label: "Redis eingeschränkt",
    description: "Zwischenspeicher läuft im Fallback-Modus.",
  },
  2: {
    label: "Online-Zahlung eingeschränkt",
    description: "Bar- und Kartenzahlung vor Ort weiterhin möglich.",
  },
  3: {
    label: "TSE-Signierung verzögert",
    description: "Bestellungen werden erfasst, Signierung folgt automatisch.",
  },
  4: {
    label: "Live-Updates eingeschränkt",
    description: "Daten werden im Polling-Modus aktualisiert.",
  },
  5: {
    label: "Offline-Modus",
    description: "Bestellungen werden lokal zwischengespeichert.",
  },
};

export function computeDegradationLevel(input: DegradationInput): DegradationLevel {
  if (
    input.connectionStatus === "offline" ||
    input.healthStatus === "unhealthy" ||
    input.fetchFailed
  ) {
    return 5;
  }

  if (
    input.realtimeMode === "polling" ||
    input.connectionStatus === "degraded"
  ) {
    return 4;
  }

  if (input.fiskalyCircuitOpen) {
    return 3;
  }

  if (input.stripeCircuitOpen) {
    return 2;
  }

  if (input.redisDown || input.healthStatus === "degraded") {
    return 1;
  }

  return 0;
}

export function getDegradationInfo(level: DegradationLevel): DegradationInfo {
  const info = LEVEL_INFO[level];
  return { level, ...info };
}

export type HealthSummary = {
  status: "healthy" | "degraded" | "unhealthy";
  checks?: {
    redis?: { status: string };
    stripe?: { status: string };
  };
  circuits?: {
    stripe?: string;
    fiskaly?: string;
    openai?: string;
  };
};

export function parseHealthForDegradation(payload: HealthSummary | null): {
  healthStatus: DegradationInput["healthStatus"];
  redisDown: boolean;
  stripeCircuitOpen: boolean;
  fiskalyCircuitOpen: boolean;
} {
  if (!payload) {
    return {
      healthStatus: null,
      redisDown: false,
      stripeCircuitOpen: false,
      fiskalyCircuitOpen: false,
    };
  }

  const redisDown = payload.checks?.redis?.status === "down";
  const stripeCircuitOpen = payload.circuits?.stripe === "open";
  const fiskalyCircuitOpen = payload.circuits?.fiskaly === "open";

  return {
    healthStatus: payload.status,
    redisDown,
    stripeCircuitOpen,
    fiskalyCircuitOpen,
  };
}

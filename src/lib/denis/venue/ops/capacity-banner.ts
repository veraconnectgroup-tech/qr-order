import type { StationQueue } from "@/lib/denis/venue/floor/types";
import type { OpsPlannerEffects } from "@/lib/denis/venue/ops/types";

export type CapacityLevel = "green" | "yellow" | "red";

export type CapacityBanner = {
  level: CapacityLevel;
  estimatedWaitMinutes: number;
  message: string;
  showBanner: boolean;
};

export const CAPACITY_REFRESH_BUCKET_MS = 120_000;

/** Quantize clock for 2-minute guest banner refresh cadence. */
export function quantizeCapacityNowMs(nowMs: number): number {
  return Math.floor(nowMs / CAPACITY_REFRESH_BUCKET_MS) * CAPACITY_REFRESH_BUCKET_MS;
}

function kitchenQueue(queues: StationQueue[]): StationQueue | undefined {
  return queues.find((queue) => queue.station === "kitchen");
}

function resolveAvgWaitMinutes(input: {
  stationQueues: StationQueue[];
  activeOrderCount: number;
  avgPrepMinutes: number;
}): number {
  const kitchen = kitchenQueue(input.stationQueues);
  const queueWait = kitchen?.avgWaitMinutes ?? 0;
  const backlogEstimate =
    input.activeOrderCount > 0
      ? Math.round((input.avgPrepMinutes * input.activeOrderCount) / 12)
      : 0;
  return Math.max(queueWait, backlogEstimate);
}

function resolveLevel(avgWait: number, rushMode: boolean): CapacityLevel {
  let level: CapacityLevel =
    avgWait < 10 ? "green" : avgWait <= 20 ? "yellow" : "red";
  if (rushMode && level === "green") {
    level = "yellow";
  }
  return level;
}

function buildMessage(level: CapacityLevel, waitMinutes: number): string {
  if (level === "green") return "";
  if (level === "yellow") {
    return `🟡 Kuhinja malo zauzeta — ~${waitMinutes} min čekanja`;
  }
  return `🔴 Kuhinja pod punim kapacitetom — ~${waitMinutes} min. Preporučujemo brže opcije.`;
}

/** Resolve guest kitchen capacity banner (P4) — warm tone, deterministic. */
export function resolveCapacityBanner(input: {
  stationQueues: StationQueue[];
  activeOrderCount: number;
  avgPrepMinutes: number;
  rushMode: boolean;
  nowMs?: number;
}): CapacityBanner {
  void quantizeCapacityNowMs(input.nowMs ?? Date.now());

  const avgWait = resolveAvgWaitMinutes(input);
  const level = resolveLevel(avgWait, input.rushMode);
  const estimatedWaitMinutes = Math.max(1, avgWait);
  const message = buildMessage(level, estimatedWaitMinutes);

  return {
    level,
    estimatedWaitMinutes,
    message,
    showBanner: level !== "green",
  };
}

export function stationQueuesFromStress(
  stationStress: Array<{
    station: StationQueue["station"];
    activeCount: number;
    avgWaitMinutes: number | null;
  }>
): StationQueue[] {
  return stationStress.map((row) => ({
    station: row.station,
    activeOrderCount: row.activeCount,
    avgWaitMinutes: row.avgWaitMinutes,
    oldestOrderMinutes: null,
  }));
}

export function mergeCapacityPlannerEffects(
  base: OpsPlannerEffects,
  banner: CapacityBanner
): OpsPlannerEffects {
  if (banner.level === "green") {
    return {
      ...base,
      capacityLevel: "green",
      capacityBanner: null,
    };
  }

  const empathyNote =
    banner.level === "red"
      ? (base.empathyNote ??
        "Kuhinja trenutno radi punim gasom — hvala na strpljenju.")
      : base.empathyNote;

  return {
    ...base,
    capacityLevel: banner.level,
    capacityBanner: banner,
    preferQuickPrep: true,
    suppressComplexDishes: banner.level === "red",
    empathyNote,
  };
}

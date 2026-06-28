import type { StationQueue } from "@/lib/denis/venue/floor/types";
import type { KdsStressLevel, StationStress } from "@/lib/denis/venue/ops/types";

const STATION_STRESS_THRESHOLDS: Partial<Record<
  StationQueue["station"],
  number
>> = {
  kitchen: 20,
  bar: 10,
  dessert: 15,
};

function stressForStation(
  queue: StationQueue,
  thresholdMinutes: number
): KdsStressLevel {
  if (queue.activeOrderCount === 0 || queue.avgWaitMinutes == null) {
    return "normal";
  }
  return queue.avgWaitMinutes >= thresholdMinutes ? "high" : "normal";
}

/** Map floor station queues to venue ops station stress beliefs. */
export function deriveStationStressFromQueues(
  queues: StationQueue[],
  kitchenThresholdMinutes = STATION_STRESS_THRESHOLDS.kitchen ?? 20
): StationStress[] {
  return queues.map((queue) => {
    const threshold =
      queue.station === "kitchen"
        ? kitchenThresholdMinutes
        : (STATION_STRESS_THRESHOLDS[queue.station] ?? kitchenThresholdMinutes);

    return {
      station: queue.station,
      stress: stressForStation(queue, threshold),
      activeCount: queue.activeOrderCount,
      avgWaitMinutes: queue.avgWaitMinutes,
    };
  });
}

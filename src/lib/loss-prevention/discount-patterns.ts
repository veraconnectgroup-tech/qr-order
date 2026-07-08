import type { SensitiveActionRow } from "@/lib/audit/sensitive-action-types";

export type DiscountPatternInput = {
  staffId: string;
  discountCount: number;
  locationAverage: number;
  deviationMultiplier?: number;
};

export type DiscountPatternResult = {
  flagged: boolean;
  staffId: string;
  discountCount: number;
  locationAverage: number;
  threshold: number;
};

/** Relative discount deviation vs location average — ADR-044 S6. */
export function evaluateDiscountPattern(
  input: DiscountPatternInput
): DiscountPatternResult {
  const multiplier = input.deviationMultiplier ?? 2;
  const average = Math.max(input.locationAverage, 0.5);
  const threshold = average * multiplier;

  return {
    flagged: input.discountCount > threshold,
    staffId: input.staffId,
    discountCount: input.discountCount,
    locationAverage: average,
    threshold,
  };
}

export function countDiscountsByStaff(
  rows: SensitiveActionRow[],
  staffField: "actor_id" = "actor_id"
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.sensitive_action !== "discount") continue;
    const staffId = row[staffField];
    if (!staffId) continue;
    counts.set(staffId, (counts.get(staffId) ?? 0) + 1);
  }
  return counts;
}

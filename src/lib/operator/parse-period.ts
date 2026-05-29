import type { OperatorPeriod } from "@/lib/operator/types";

export type PeriodBounds = {
  period: OperatorPeriod;
  from: Date;
  to: Date;
};

export function parseOperatorPeriod(
  value: string | null | undefined,
  now: Date = new Date()
): PeriodBounds {
  const period: OperatorPeriod =
    value === "yesterday" || value === "7d" ? value : "today";

  const from = new Date(now);
  const to = new Date(now);

  if (period === "today") {
    from.setHours(0, 0, 0, 0);
  } else if (period === "yesterday") {
    from.setDate(from.getDate() - 1);
    from.setHours(0, 0, 0, 0);
    to.setDate(to.getDate() - 1);
    to.setHours(23, 59, 59, 999);
  } else {
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);
  }

  return { period, from, to };
}

export function periodToIsoRange(bounds: PeriodBounds): { from: string; to: string } {
  return {
    from: bounds.from.toISOString(),
    to: bounds.to.toISOString(),
  };
}

import type { NudgeOutcomeRecord } from "@/lib/denis/cognition/offer/nudge-outcome-types";

const ATTRIBUTION_WINDOW_MS = 15 * 60 * 1000;

export type NudgeRevenueOrderLine = {
  orderId: string;
  orderItemId?: string;
  productId: string;
  lineTotalCents: number;
  createdAt: string;
};

export type AttributedNudgeRevenue = {
  nudgeId: string;
  productId: string;
  orderId: string;
  orderItemId: string | null;
  grossCents: number;
  attributionWindowMs: number;
};

/** Pure fold — match accepted nudge outcomes to order line snapshots (ADR-039 L3). */
export function foldNudgeRevenueAttribution(input: {
  outcomes: NudgeOutcomeRecord[];
  orderLines: NudgeRevenueOrderLine[];
}): AttributedNudgeRevenue[] {
  const accepted = input.outcomes.filter(
    (row) => row.outcome === "accepted" && row.productId
  );
  if (accepted.length === 0 || input.orderLines.length === 0) return [];

  const attributed: AttributedNudgeRevenue[] = [];

  for (const outcome of accepted) {
    const productId = outcome.productId!;
    const convertedMs = new Date(outcome.resolvedAt).getTime();
    const windowEnd = convertedMs + ATTRIBUTION_WINDOW_MS;

    const match = input.orderLines
      .filter((line) => {
        if (line.productId !== productId) return false;
        const orderMs = new Date(line.createdAt).getTime();
        return orderMs >= convertedMs && orderMs <= windowEnd;
      })
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )[0];

    if (!match) continue;

    attributed.push({
      nudgeId: outcome.nudgeId,
      productId,
      orderId: match.orderId,
      orderItemId: match.orderItemId ?? null,
      grossCents: match.lineTotalCents,
      attributionWindowMs: ATTRIBUTION_WINDOW_MS,
    });
  }

  return attributed;
}

export function sumAttributedNudgeRevenueCents(
  rows: AttributedNudgeRevenue[]
): number {
  return rows.reduce((sum, row) => sum + row.grossCents, 0);
}

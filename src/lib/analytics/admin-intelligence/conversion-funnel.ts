import type {
  ConversionFunnelSnapshot,
  ConversionFunnelStep,
  FunnelStageKey,
} from "@/lib/analytics/admin-intelligence/types";

const STAGE_LABELS: Record<FunnelStageKey, string> = {
  scan_qr: "Scan QR",
  open_menu: "Open Menu",
  browse: "Browse",
  add_to_cart: "Add to Cart",
  order: "Order",
  pay: "Pay",
};

const STAGE_ORDER: FunnelStageKey[] = [
  "scan_qr",
  "open_menu",
  "browse",
  "add_to_cart",
  "order",
  "pay",
];

export type FunnelCounts = Record<FunnelStageKey, number>;

export function buildConversionFunnel(counts: FunnelCounts): ConversionFunnelSnapshot {
  const baseline = Math.max(1, counts.scan_qr);
  let biggestDropOffStage: FunnelStageKey | null = null;
  let biggestDropOff = 0;

  const steps: ConversionFunnelStep[] = STAGE_ORDER.map((stage, index) => {
    const count = counts[stage];
    const previousStage = index > 0 ? STAGE_ORDER[index - 1]! : null;
    const previousCount = previousStage ? counts[previousStage] : null;

    const pctOfPrevious =
      previousCount != null && previousCount > 0
        ? Math.round((count / previousCount) * 1000) / 10
        : null;

    const dropOffPct =
      pctOfPrevious != null ? Math.round((100 - pctOfPrevious) * 10) / 10 : null;

    if (dropOffPct != null && dropOffPct > biggestDropOff) {
      biggestDropOff = dropOffPct;
      biggestDropOffStage = stage;
    }

    return {
      stage,
      label: STAGE_LABELS[stage],
      count,
      pctOfPrevious,
      pctOfTotal: Math.round((count / baseline) * 1000) / 10,
      dropOffPct,
    };
  });

  const cartAbandonmentRate =
    counts.add_to_cart > 0
      ? Math.round(((counts.add_to_cart - counts.order) / counts.add_to_cart) * 1000) / 10
      : 0;

  return {
    steps,
    cartAbandonmentRate,
    biggestDropOffStage,
  };
}

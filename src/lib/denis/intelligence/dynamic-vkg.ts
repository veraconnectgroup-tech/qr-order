/** X1 — Dynamic VKG: discover pairings from order history via market basket analysis. */

export type LearnedPairingDirection =
  | "A_then_B"
  | "B_then_A"
  | "simultaneous";

export type LearnedPairingSource = "order_history" | "basket_analysis";

export type LearnedPairing = {
  productA: string;
  productB: string;
  coOrderCount: number;
  confidence: number;
  lift: number;
  support: number;
  avgTimeBetween: number;
  direction: LearnedPairingDirection;
  source: LearnedPairingSource;
  autoAdd: boolean;
  needsApproval: boolean;
};

export type OrderWithItems = {
  id: string;
  createdAt: string;
  items: Array<{
    productId: string;
    createdAt?: string;
  }>;
};

export const MARKET_BASKET_THRESHOLDS = {
  minCoOccurrence: 5,
  support: 0.05,
  confidence: 0.3,
  liftAutoAdd: 2.0,
  liftNeedsApproval: 1.5,
  lookbackDays: 30,
} as const;

const MIN_CO_OCCURRENCE_DEFAULT = MARKET_BASKET_THRESHOLDS.minCoOccurrence;
const SUPPORT_THRESHOLD = MARKET_BASKET_THRESHOLDS.support;
const CONFIDENCE_THRESHOLD = MARKET_BASKET_THRESHOLDS.confidence;
const LIFT_AUTO_ADD = MARKET_BASKET_THRESHOLDS.liftAutoAdd;
const LIFT_NEEDS_APPROVAL = MARKET_BASKET_THRESHOLDS.liftNeedsApproval;
const TEMPORAL_WINDOW_MS = 10 * 60_000;

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function resolveDirection(
  order: OrderWithItems,
  productA: string,
  productB: string
): LearnedPairingDirection {
  const itemA = order.items.find((i) => i.productId === productA);
  const itemB = order.items.find((i) => i.productId === productB);
  if (!itemA?.createdAt || !itemB?.createdAt) return "simultaneous";

  const delta = Date.parse(itemB.createdAt) - Date.parse(itemA.createdAt);
  if (Math.abs(delta) <= TEMPORAL_WINDOW_MS) {
    if (delta > 0) return "A_then_B";
    if (delta < 0) return "B_then_A";
  }
  return "simultaneous";
}

/** Alias for cron/docs — market basket analysis over order history. */
export function runMarketBasketAnalysis(input: {
  orders: OrderWithItems[];
  minCoOccurrence?: number;
  lookbackDays?: number;
}): LearnedPairing[] {
  return discoverPairings(input);
}

export function discoverPairings(input: {
  orders: OrderWithItems[];
  minCoOccurrence?: number;
  lookbackDays?: number;
}): LearnedPairing[] {
  const minCoOccurrence = input.minCoOccurrence ?? MIN_CO_OCCURRENCE_DEFAULT;
  const lookbackMs = (input.lookbackDays ?? 30) * 86_400_000;
  const cutoff = Date.now() - lookbackMs;

  const recentOrders = input.orders.filter(
    (order) => Date.parse(order.createdAt) >= cutoff
  );
  const totalOrders = recentOrders.length;
  if (totalOrders === 0) return [];

  const productOrderCount = new Map<string, number>();
  const pairStats = new Map<
    string,
    {
      productA: string;
      productB: string;
      coCount: number;
      timeDeltas: number[];
      directions: LearnedPairingDirection[];
    }
  >();

  for (const order of recentOrders) {
    const productIds = [...new Set(order.items.map((i) => i.productId))];
    for (const id of productIds) {
      productOrderCount.set(id, (productOrderCount.get(id) ?? 0) + 1);
    }

    for (let i = 0; i < productIds.length; i += 1) {
      for (let j = i + 1; j < productIds.length; j += 1) {
        const a = productIds[i]!;
        const b = productIds[j]!;
        const key = pairKey(a, b);
        const existing = pairStats.get(key) ?? {
          productA: a,
          productB: b,
          coCount: 0,
          timeDeltas: [],
          directions: [],
        };
        existing.coCount += 1;
        existing.directions.push(resolveDirection(order, a, b));
        pairStats.set(key, existing);
      }
    }
  }

  const results: LearnedPairing[] = [];

  for (const stats of pairStats.values()) {
    if (stats.coCount < minCoOccurrence) continue;

    const support = stats.coCount / totalOrders;
    const countA = productOrderCount.get(stats.productA) ?? 1;
    const confidence = stats.coCount / countA;
    const supportB = (productOrderCount.get(stats.productB) ?? 1) / totalOrders;
    const lift = supportB > 0 ? confidence / supportB : 0;

    if (support < SUPPORT_THRESHOLD || confidence < CONFIDENCE_THRESHOLD) {
      continue;
    }
    if (lift < LIFT_NEEDS_APPROVAL) continue;

    const directionCounts = new Map<LearnedPairingDirection, number>();
    for (const dir of stats.directions) {
      directionCounts.set(dir, (directionCounts.get(dir) ?? 0) + 1);
    }
    const direction = [...directionCounts.entries()].sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0] ?? "simultaneous";

    results.push({
      productA: stats.productA,
      productB: stats.productB,
      coOrderCount: stats.coCount,
      confidence,
      lift,
      support,
      avgTimeBetween: 0,
      direction,
      source: "order_history",
      autoAdd: lift >= LIFT_AUTO_ADD,
      needsApproval: lift >= LIFT_NEEDS_APPROVAL && lift < LIFT_AUTO_ADD,
    });
  }

  return results.sort((a, b) => b.lift - a.lift);
}

export function formatLearnedPairingGuestPrompt(input: {
  anchorName: string;
  suggestName: string;
}): string {
  return `Gosti koji naruče ${input.anchorName} često uzmu i ${input.suggestName} — hoćete?`;
}

export function formatDiscoveredPairingLine(
  pairing: LearnedPairing,
  productNames?: Record<string, string>
): string {
  const anchor =
    productNames?.[pairing.productA]?.trim() || pairing.productA.slice(0, 8);
  const suggest =
    productNames?.[pairing.productB]?.trim() || pairing.productB.slice(0, 8);
  const pct = Math.round(pairing.confidence * 100);
  const supportPct = Math.round(pairing.support * 100);
  const status = pairing.autoAdd
    ? "✅ auto-added"
    : pairing.needsApproval
      ? "🟡 needs approval"
      : "⏸ pending";
  return `${anchor} → ${suggest} (${pct}% conf, ${supportPct}% support, lift ${pairing.lift.toFixed(1)}, n=${pairing.coOrderCount}) ${status}`;
}

export function learnedEdgeRowToPairing(row: {
  from_product_id: string;
  to_product_id: string;
  impressions: number;
  accepts: number;
  accept_rate: number;
  suggested_weight: number;
}): LearnedPairing {
  const lift = Number(row.suggested_weight) * 5;
  const confidence = Number(row.accept_rate);
  const coOrderCount = Number(row.impressions);
  const support = Math.max(
    MARKET_BASKET_THRESHOLDS.support,
    coOrderCount / Math.max(100, coOrderCount * 3)
  );

  return {
    productA: row.from_product_id,
    productB: row.to_product_id,
    coOrderCount,
    confidence,
    lift,
    support,
    avgTimeBetween: 0,
    direction: "simultaneous",
    source: "basket_analysis",
    autoAdd: lift >= LIFT_AUTO_ADD,
    needsApproval: lift >= LIFT_NEEDS_APPROVAL && lift < LIFT_AUTO_ADD,
  };
}

export function meetsLearnedPairingSuggestionThreshold(
  pairing: Pick<LearnedPairing, "confidence" | "support">
): boolean {
  return (
    pairing.confidence >= CONFIDENCE_THRESHOLD &&
    pairing.support >= SUPPORT_THRESHOLD
  );
}

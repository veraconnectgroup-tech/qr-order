import type {
  MenuPerformanceMatrixSnapshot,
  MenuPerformanceRow,
} from "@/lib/analytics/admin-intelligence/types";

export type MenuMatrixProductInput = {
  id: string;
  name: string;
  price: number;
  prepTimeMinutes: number | null;
};

export type MenuMatrixOrderLine = {
  productId: string;
  productName: string;
  quantity: number;
  revenue: number;
  sessionId?: string | null;
};

const DEFAULT_FOOD_COST_RATIO = 0.35;

function marginFromPrice(price: number): number {
  if (price <= 0) return 0;
  return Math.round((1 - DEFAULT_FOOD_COST_RATIO) * 1000) / 10;
}

function buildSuggestion(row: {
  orderCount: number;
  profitMarginPct: number | null;
  medianOrders: number;
}): string | null {
  const highMargin = (row.profitMarginPct ?? 0) >= 60;
  const lowOrders = row.orderCount < row.medianOrders;

  if (highMargin && lowOrders) {
    return "Boost in Denis suggestions — high margin, low ordering";
  }
  if (row.orderCount >= row.medianOrders * 2) {
    return "Top seller — keep prominent on menu";
  }
  if ((row.profitMarginPct ?? 0) < 45 && row.orderCount > row.medianOrders) {
    return "Review pricing or portion — low margin workhorse";
  }
  return null;
}

export function buildMenuPerformanceMatrix(input: {
  products: MenuMatrixProductInput[];
  orderLines: MenuMatrixOrderLine[];
  satisfactionByProductId?: Record<string, number>;
}): MenuPerformanceMatrixSnapshot {
  const byProduct = new Map<
    string,
    {
      name: string;
      orderCount: number;
      revenue: number;
      sessions: Set<string>;
      repeatSessions: Set<string>;
      sessionCounts: Map<string, number>;
    }
  >();

  for (const line of input.orderLines) {
    const bucket = byProduct.get(line.productId) ?? {
      name: line.productName,
      orderCount: 0,
      revenue: 0,
      sessions: new Set<string>(),
      repeatSessions: new Set<string>(),
      sessionCounts: new Map<string, number>(),
    };
    bucket.orderCount += line.quantity;
    bucket.revenue += line.revenue;
    if (line.sessionId) {
      bucket.sessions.add(line.sessionId);
      const prev = bucket.sessionCounts.get(line.sessionId) ?? 0;
      bucket.sessionCounts.set(line.sessionId, prev + 1);
      if (prev >= 1) bucket.repeatSessions.add(line.sessionId);
    }
    byProduct.set(line.productId, bucket);
  }

  const orderCounts = [...byProduct.values()].map((row) => row.orderCount);
  const medianOrders =
    orderCounts.length > 0
      ? orderCounts.sort((a, b) => a - b)[Math.floor(orderCounts.length / 2)]!
      : 0;

  const productById = new Map(input.products.map((product) => [product.id, product]));

  const items: MenuPerformanceRow[] = [...byProduct.entries()]
    .map(([productId, stats]) => {
      const product = productById.get(productId);
      const satisfaction = input.satisfactionByProductId?.[productId];
      const sessionCount = stats.sessions.size;
      const returnRatePct =
        sessionCount > 0
          ? Math.round((stats.repeatSessions.size / sessionCount) * 1000) / 10
          : null;

      const row: MenuPerformanceRow = {
        productId,
        name: product?.name ?? stats.name,
        orderCount: stats.orderCount,
        revenue: Math.round(stats.revenue * 100) / 100,
        prepTimeMinutes: product?.prepTimeMinutes ?? null,
        profitMarginPct: product ? marginFromPrice(product.price) : null,
        satisfactionPct:
          satisfaction != null ? Math.round(satisfaction * 1000) / 10 : null,
        returnRatePct,
        suggestion: null,
        rank: 0,
      };
      row.suggestion = buildSuggestion({
        orderCount: row.orderCount,
        profitMarginPct: row.profitMarginPct,
        medianOrders,
      });
      return row;
    })
    .sort((a, b) => b.revenue - a.revenue)
    .map((row, index) => ({ ...row, rank: index + 1 }));

  const boostCandidates = items.filter((row) =>
    row.suggestion?.includes("Boost in Denis")
  );

  return { items, boostCandidates };
}

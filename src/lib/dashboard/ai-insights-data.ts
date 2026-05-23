import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScrollContext } from "@/lib/ai/scroll-context";

export type AiInsightsRange = "today" | "week";

export type AiInsightsSummary = {
  aiRevenue: number;
  conversionRate: number;
  addedCount: number;
  recommendedCount: number;
  averageRating: number | null;
  avgMinutesToFirstOrder: number | null;
};

export type AiInsightsMenuGap = {
  term: string;
  count: number;
};

export type AiInsightsTopProduct = {
  productId: string;
  name: string;
  count: number;
};

export type AiInsightsAlert = {
  label: string;
  detail: string;
  severity: "info" | "warning" | "critical";
};

export type AiInsightRow = {
  id: string;
  type: string;
  severity: string;
  title: string;
  detail: string;
  insight_date: string;
  is_read: boolean;
  metadata: Record<string, unknown>;
};

export type AiInsightsDashboardPayload = {
  enabled: boolean;
  range: AiInsightsRange;
  summary: AiInsightsSummary;
  menuGaps: AiInsightsMenuGap[];
  topProducts: AiInsightsTopProduct[];
  alerts: AiInsightsAlert[];
  insights: AiInsightRow[];
};

type SessionRow = {
  id: string;
  session_token: string;
  created_at: string;
  messages: Array<{ role: string; content: string }>;
  products_recommended: string[];
  products_added: string[];
  conversion_count: number;
  scroll_context: ScrollContext | null;
  guest_rating: number | null;
};

const NOT_AVAILABLE =
  /(?:nicht\s+(?:auf|im)\s+(?:der\s+)?(?:karte|menü|menu)|leider\s+nicht|not\s+(?:on|in)\s+(?:the\s+)?menu|don't\s+have|haben\s+wir\s+nicht)/i;

export function parseAiInsightsRange(value: string | null): AiInsightsRange {
  return value === "week" ? "week" : "today";
}

function getRangeBounds(range: AiInsightsRange) {
  const end = new Date();
  const start = new Date();
  if (range === "today") {
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  }

  const insightDates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    insightDates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    insightDates,
  };
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").trim();
}

function matchesProduct(term: string, productNames: string[]) {
  const needle = normalizeName(term);
  return productNames.some(
    (name) =>
      normalizeName(name).includes(needle) ||
      needle.includes(normalizeName(name))
  );
}

function extractMenuGaps(sessions: SessionRow[], productNames: string[]) {
  const gaps = new Map<string, number>();
  for (const session of sessions) {
    for (let i = 0; i < session.messages.length - 1; i++) {
      const user = session.messages[i];
      const assistant = session.messages[i + 1];
      if (user?.role !== "user" || assistant?.role !== "assistant") continue;
      if (!NOT_AVAILABLE.test(assistant.content)) continue;
      const tokens = user.content
        .split(/\s+/)
        .map((part) => part.replace(/[^\p{L}\p{N}]/gu, ""))
        .filter((part) => part.length >= 4);
      const term =
        tokens.find((token) => !matchesProduct(token, productNames)) ??
        user.content.slice(0, 60).trim();
      if (!term) continue;
      gaps.set(term, (gaps.get(term) ?? 0) + 1);
    }
  }
  return [...gaps.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([term, count]) => ({ term, count }));
}

function extractTopProducts(
  sessions: SessionRow[],
  productNameById: Map<string, string>
) {
  const counts = new Map<string, number>();
  for (const session of sessions) {
    for (const productId of session.products_added) {
      counts.set(productId, (counts.get(productId) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([productId, count]) => ({
      productId,
      name: productNameById.get(productId) ?? productId.slice(0, 8),
      count,
    }));
}

function extractViewAlerts(
  sessions: SessionRow[],
  products: Array<{ id: string; name: string }>
) {
  const alerts: AiInsightsAlert[] = [];
  const viewed = new Map<string, { name: string; views: number; orders: number }>();

  for (const session of sessions) {
    const added = new Set(session.products_added);
    for (const view of session.scroll_context?.views ?? []) {
      if (view.count < 2) continue;
      const product = products.find((row) =>
        matchesProduct(view.name, [row.name])
      );
      if (!product) continue;
      const current = viewed.get(product.id) ?? {
        name: product.name,
        views: 0,
        orders: 0,
      };
      current.views += view.count;
      if (added.has(product.id)) current.orders += 1;
      viewed.set(product.id, current);
    }
  }

  for (const entry of viewed.values()) {
    if (entry.views < 3 || entry.orders > 0) continue;
    alerts.push({
      label: entry.name,
      detail: `${entry.views}x angesehen, ${entry.orders}x bestellt`,
      severity: "warning",
    });
  }

  return alerts.slice(0, 5);
}

export async function fetchAiInsightsDashboard(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    range: AiInsightsRange;
  }
): Promise<AiInsightsDashboardPayload> {
  const { orgId, locationId, range } = input;
  const { start, end, insightDates } = getRangeBounds(range);

  const { data: locationRow } = await admin
    .from("locations")
    .select("ai_concierge_enabled")
    .eq("id", locationId)
    .eq("org_id", orgId)
    .maybeSingle();

  const enabled =
    (locationRow as { ai_concierge_enabled?: boolean } | null)
      ?.ai_concierge_enabled ?? false;

  const empty: AiInsightsDashboardPayload = {
    enabled,
    range,
    summary: {
      aiRevenue: 0,
      conversionRate: 0,
      addedCount: 0,
      recommendedCount: 0,
      averageRating: null,
      avgMinutesToFirstOrder: null,
    },
    menuGaps: [],
    topProducts: [],
    alerts: [],
    insights: [],
  };

  if (!enabled) return empty;

  const { data: sessionRows } = await admin
    .from("ai_sessions")
    .select(
      "id, session_token, created_at, messages, products_recommended, products_added, conversion_count, scroll_context, guest_rating"
    )
    .eq("org_id", orgId)
    .eq("location_id", locationId)
    .gte("created_at", start)
    .lte("created_at", end);

  const sessions = (sessionRows ?? []) as SessionRow[];

  const { data: productRows } = await admin
    .from("products")
    .select("id, name")
    .eq("location_id", locationId)
    .is("deleted_at", null);

  const products = (productRows ?? []) as Array<{ id: string; name: string }>;
  const productNames = products.map((row) => row.name);
  const productNameById = new Map(products.map((row) => [row.id, row.name]));

  const recommendedCount = sessions.reduce(
    (sum, row) => sum + row.products_recommended.length,
    0
  );
  const addedCount = sessions.reduce(
    (sum, row) => sum + row.products_added.length,
    0
  );
  const addedProductIds = [...new Set(sessions.flatMap((row) => row.products_added))];

  let aiRevenue = 0;
  if (addedProductIds.length) {
    const { data: itemRows } = await admin
      .from("order_items")
      .select("total, product_id, orders!inner(location_id, created_at)")
      .eq("orders.location_id", locationId)
      .gte("orders.created_at", start)
      .lte("orders.created_at", end)
      .in("product_id", addedProductIds);

    aiRevenue = (itemRows ?? []).reduce(
      (sum, row) => sum + Number((row as { total: number }).total),
      0
    );
  }

  const sessionTokens = [...new Set(sessions.map((row) => row.session_token))];
  let avgMinutesToFirstOrder: number | null = null;

  if (sessionTokens.length) {
    const { data: tableSessionRows } = await admin
      .from("table_sessions")
      .select("id, session_token, opened_at")
      .in("session_token", sessionTokens);

    const tableSessionIds = (tableSessionRows ?? []).map(
      (row) => (row as { id: string }).id
    );

    if (tableSessionIds.length) {
      const { data: orderRows } = await admin
        .from("orders")
        .select("session_id, created_at")
        .in("session_id", tableSessionIds)
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: true });

      const tokenBySessionId = new Map(
        (tableSessionRows ?? []).map((row) => {
          const typed = row as { id: string; session_token: string };
          return [typed.id, typed.session_token] as const;
        })
      );

      const firstOrderByToken = new Map<string, number>();
      for (const order of orderRows ?? []) {
        const typed = order as { session_id: string; created_at: string };
        const token = tokenBySessionId.get(typed.session_id);
        if (!token || firstOrderByToken.has(token)) continue;
        firstOrderByToken.set(token, new Date(typed.created_at).getTime());
      }

      const diffs: number[] = [];
      for (const session of sessions) {
        const firstOrderAt = firstOrderByToken.get(session.session_token);
        if (!firstOrderAt) continue;
        const startedAt = new Date(session.created_at).getTime();
        diffs.push((firstOrderAt - startedAt) / 60_000);
      }

      if (diffs.length) {
        avgMinutesToFirstOrder =
          Math.round((diffs.reduce((a, b) => a + b, 0) / diffs.length) * 10) /
          10;
      }
    }
  }

  const { data: feedbackRows } = await admin
    .from("order_feedback")
    .select("rating")
    .eq("location_id", locationId)
    .gte("created_at", start)
    .lte("created_at", end);

  const ratings = [
    ...(feedbackRows ?? []).map(
      (row) => (row as { rating: number }).rating
    ),
    ...sessions
      .map((row) => row.guest_rating)
      .filter((value): value is number => typeof value === "number"),
  ];

  const averageRating =
    ratings.length > 0
      ? Math.round(
          (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) *
            10
        ) / 10
      : null;

  const { data: insightRows } = await admin
    .from("ai_insights")
    .select("id, type, severity, title, detail, insight_date, is_read, metadata")
    .eq("org_id", orgId)
    .eq("location_id", locationId)
    .in("insight_date", insightDates)
    .order("insight_date", { ascending: false });

  const insights = (insightRows ?? []) as AiInsightRow[];

  const menuGapsFromInsights = new Map<string, number>();
  for (const insight of insights.filter((row) => row.type === "menu_gap")) {
    const term =
      (insight.metadata?.term as string | undefined) ??
      insight.title.replace(/^Menu gap:\s*"?|"$/g, "");
    const count = Number(insight.metadata?.count ?? 1);
    menuGapsFromInsights.set(term, (menuGapsFromInsights.get(term) ?? 0) + count);
  }

  const menuGaps =
    menuGapsFromInsights.size > 0
      ? [...menuGapsFromInsights.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([term, count]) => ({ term, count }))
      : extractMenuGaps(sessions, productNames);

  const topProducts = extractTopProducts(sessions, productNameById);

  const alerts: AiInsightsAlert[] = [
    ...extractViewAlerts(sessions, products),
    ...insights
      .filter((row) => row.type === "alert" || row.type === "conversion")
      .slice(0, 3)
      .map((row) => ({
        label: row.title,
        detail: row.detail,
        severity: row.severity as AiInsightsAlert["severity"],
      })),
  ];

  if (avgMinutesToFirstOrder != null) {
    alerts.push({
      label: "Zeit bis erste Bestellung",
      detail: `Ø ${avgMinutesToFirstOrder} min nach AI-Start`,
      severity: avgMinutesToFirstOrder > 12 ? "warning" : "info",
    });
  }

  return {
    enabled,
    range,
    summary: {
      aiRevenue,
      conversionRate:
        recommendedCount > 0 ? addedCount / recommendedCount : 0,
      addedCount,
      recommendedCount,
      averageRating,
      avgMinutesToFirstOrder,
    },
    menuGaps,
    topProducts,
    alerts: alerts.slice(0, 5),
    insights,
  };
}

import type { AnalyticsDateRange } from "@/lib/analytics/date-range";
import { loadAdminAnalyticsOrders } from "@/lib/analytics/admin-analytics";
import { buildCompetitorBenchmark } from "@/lib/analytics/admin-intelligence/competitor-benchmark";
import { buildConversionFunnel } from "@/lib/analytics/admin-intelligence/conversion-funnel";
import { buildDenisPerformanceSnapshot } from "@/lib/analytics/admin-intelligence/denis-performance";
import {
  buildMenuPerformanceMatrix,
  type MenuMatrixOrderLine,
} from "@/lib/analytics/admin-intelligence/menu-matrix";
import { buildTimeAnalytics } from "@/lib/analytics/admin-intelligence/time-analytics";
import type { AdminIntelligenceSnapshot } from "@/lib/analytics/admin-intelligence/types";
import { requireAdmin, getStaffLocationId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

function mergeCountMaps(
  target: Record<string, number>,
  source: Record<string, number> | null | undefined
) {
  for (const [key, value] of Object.entries(source ?? {})) {
    target[key] = (target[key] ?? 0) + value;
  }
}

async function loadIntelligenceRaw(
  admin: SupabaseClient,
  locationId: string,
  from: Date,
  to: Date
) {
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const fromDate = fromIso.slice(0, 10);
  const toDate = toIso.slice(0, 10);

  const [
    { data: tableSessions },
    { data: aiSessions },
    { data: aiOrderEvents },
    { data: sessionOrders },
    { data: products },
    { data: orderLines },
    { data: experienceRows },
    { data: traceRows },
    { data: waiterStaff },
  ] = await Promise.all([
    admin
      .from("table_sessions")
      .select("id, table_id, denis_shared_ai_session_id, opened_at")
      .eq("location_id", locationId)
      .gte("opened_at", fromIso)
      .lte("opened_at", toIso),
    admin
      .from("ai_sessions")
      .select(
        "id, table_id, language, messages, products_added, scroll_context, conversion_count, guest_rating, order_draft"
      )
      .eq("location_id", locationId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso),
    admin
      .from("ai_order_events")
      .select("ai_session_id, event_type")
      .gte("created_at", fromIso)
      .lte("created_at", toIso),
    admin
      .from("orders")
      .select("id, session_id, payment_status, status")
      .eq("location_id", locationId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .neq("status", "cancelled"),
    admin
      .from("products")
      .select("id, name, price, prep_time_minutes")
      .eq("location_id", locationId)
      .is("deleted_at", null),
    admin
      .from("orders")
      .select(
        "session_id, order_items(product_id, product_name, quantity, total)"
      )
      .eq("location_id", locationId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .not("status", "in", '("cancelled","rejected")'),
    admin
      .from("experience_analytics_daily")
      .select(
        "nudge_impressions, offer_conversions, by_nudge_kind, by_outcome"
      )
      .eq("location_id", locationId)
      .gte("metric_date", fromDate)
      .lte("metric_date", toDate),
    admin
      .from("denis_turn_traces")
      .select("total_duration_ms")
      .eq("location_id", locationId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .limit(500),
    admin
      .from("staff")
      .select("id, role")
      .in("role", ["waiter", "staff", "manager"])
      .is("deleted_at", null),
  ]);

  const aiSessionIds = ((aiSessions ?? []) as Array<{ id: string }>).map(
    (row) => row.id
  );

  let timelineEvents: Array<{
    event_type: string;
    payload: unknown;
    ai_session_id: string;
  }> = [];

  if (aiSessionIds.length) {
    const { data } = await admin
      .from("denis_timeline")
      .select("event_type, payload, ai_session_id")
      .in("ai_session_id", aiSessionIds)
      .gte("created_at", fromIso)
      .lte("created_at", toIso);
    timelineEvents = (data ?? []) as typeof timelineEvents;
  }

  return {
    tableSessions: tableSessions ?? [],
    aiSessions: aiSessions ?? [],
    aiOrderEvents: aiOrderEvents ?? [],
    sessionOrders: sessionOrders ?? [],
    products: products ?? [],
    orderLines: orderLines ?? [],
    experienceRows: experienceRows ?? [],
    traceRows: traceRows ?? [],
    waiterStaff: waiterStaff ?? [],
    timelineEvents,
  };
}

function buildFunnelCounts(raw: Awaited<ReturnType<typeof loadIntelligenceRaw>>) {
  const sessions = raw.tableSessions as Array<{ id: string }>;
  const cartEventSessions = new Set(
    (raw.aiOrderEvents as Array<{ ai_session_id: string; event_type: string }>)
      .filter((row) =>
        ["draft_updated", "cart_applied", "submit_requested"].includes(
          row.event_type
        )
      )
      .map((row) => row.ai_session_id)
  );

  const ordersBySession = new Map<string, { ordered: boolean; paid: boolean }>();
  for (const order of raw.sessionOrders as Array<{
    session_id: string | null;
    payment_status: string;
    status: string;
  }>) {
    if (!order.session_id) continue;
    const bucket = ordersBySession.get(order.session_id) ?? {
      ordered: false,
      paid: false,
    };
    if (order.status !== "rejected") bucket.ordered = true;
    if (order.payment_status === "paid") bucket.paid = true;
    ordersBySession.set(order.session_id, bucket);
  }

  let browse = 0;
  let addToCart = 0;

  for (const session of raw.aiSessions as Array<{
    id: string;
    messages: Array<{ role: string }> | null;
    products_added: string[] | null;
    scroll_context: unknown | null;
    order_draft: unknown | null;
  }>) {
    const hasMessages = (session.messages?.length ?? 0) > 0;
    const hasScroll = session.scroll_context != null;
    const hasProducts = (session.products_added?.length ?? 0) > 0;
    const hasDraft = session.order_draft != null;
    const hasCartEvent = cartEventSessions.has(session.id);

    if (hasScroll || hasMessages) browse += 1;
    if (hasProducts || hasDraft || hasCartEvent) addToCart += 1;
  }

  const linkedAiSessions = new Set(
    (raw.tableSessions as Array<{ denis_shared_ai_session_id: string | null }>)
      .map((row) => row.denis_shared_ai_session_id)
      .filter((id): id is string => Boolean(id))
  );
  const openMenu = Math.max(
    (raw.aiSessions as Array<{ id: string }>).length,
    linkedAiSessions.size
  );

  let order = 0;
  let pay = 0;
  for (const stats of ordersBySession.values()) {
    if (stats.ordered) order += 1;
    if (stats.paid) pay += 1;
  }

  return {
    scan_qr: sessions.length,
    open_menu: openMenu,
    browse,
    add_to_cart: addToCart,
    order,
    pay,
  };
}

export async function loadAdminIntelligenceSnapshot(
  range: AnalyticsDateRange
): Promise<AdminIntelligenceSnapshot | null> {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) return null;

  const admin = createAdminClient();
  const [orders, raw] = await Promise.all([
    loadAdminAnalyticsOrders(locationId, range.start, range.end),
    loadIntelligenceRaw(admin, locationId, range.start, range.end),
  ]);

  const funnelCounts = buildFunnelCounts(raw);
  const funnel = buildConversionFunnel(funnelCounts);

  const matrixLines: MenuMatrixOrderLine[] = [];
  for (const order of raw.orderLines as Array<{
    session_id: string | null;
    order_items: Array<{
      product_id: string | null;
      product_name: string;
      quantity: number;
      total: number | string;
    }> | null;
  }>) {
    for (const item of order.order_items ?? []) {
      if (!item.product_id) continue;
      matrixLines.push({
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.quantity,
        revenue: Number(item.total),
        sessionId: order.session_id,
      });
    }
  }

  const satisfactionByProductId: Record<string, number> = {};
  for (const session of raw.aiSessions as Array<{
    products_added: string[] | null;
    guest_rating: number | null;
  }>) {
    if (session.guest_rating == null) continue;
    for (const productId of session.products_added ?? []) {
      satisfactionByProductId[productId] = session.guest_rating / 5;
    }
  }

  const menuMatrix = buildMenuPerformanceMatrix({
    products: (raw.products as Array<{
      id: string;
      name: string;
      price: number;
      prep_time_minutes: number | null;
    }>).map((product) => ({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      prepTimeMinutes: product.prep_time_minutes,
    })),
    orderLines: matrixLines,
    satisfactionByProductId,
  });

  const waiterCount = (raw.waiterStaff as Array<{ id: string }>).length;
  const timeAnalytics = buildTimeAnalytics({
    orders,
    from: range.start,
    to: range.end,
    currentWaiterCount: Math.max(1, waiterCount),
  });

  const experienceRollup = {
    nudgeImpressions: 0,
    offerConversions: 0,
    byNudgeKind: {} as Record<string, number>,
    byOutcome: {} as Record<string, number>,
  };

  for (const row of raw.experienceRows as Array<{
    nudge_impressions: number;
    offer_conversions: number;
    by_nudge_kind: Record<string, number> | null;
    by_outcome: Record<string, number> | null;
  }>) {
    experienceRollup.nudgeImpressions += row.nudge_impressions ?? 0;
    experienceRollup.offerConversions += row.offer_conversions ?? 0;
    mergeCountMaps(
      experienceRollup.byNudgeKind,
      row.by_nudge_kind as Record<string, number> | null
    );
    mergeCountMaps(
      experienceRollup.byOutcome,
      row.by_outcome as Record<string, number> | null
    );
  }

  const traceDurations = (raw.traceRows as Array<{ total_duration_ms: number | null }>)
    .map((row) => row.total_duration_ms)
    .filter((value): value is number => typeof value === "number" && value > 0);
  const avgResponseMs =
    traceDurations.length > 0
      ? Math.round(
          traceDurations.reduce((sum, value) => sum + value, 0) /
            traceDurations.length
        )
      : null;

  const sessionsWithOrder = funnelCounts.order;
  const denisPerformance = buildDenisPerformanceSnapshot({
    sessionsCount: funnelCounts.scan_qr,
    sessionsWithOrder,
    aiSessions: raw.aiSessions as Array<{
      language: string | null;
      messages: Array<{ role: string }>;
    }>,
    timelineEvents: raw.timelineEvents,
    experienceRollup,
    avgResponseMs,
  });

  const paidOrders = orders.filter((order) => order.payment_status === "paid");
  const venueAvgTicket =
    paidOrders.length > 0
      ? paidOrders.reduce((sum, order) => sum + Number(order.total), 0) /
        paidOrders.length
      : 0;

  const competitorBenchmark = buildCompetitorBenchmark({
    venueAvgTicket,
    venueConversionRate: denisPerformance.conversionRate,
    venueCartAbandonmentRate: funnel.cartAbandonmentRate,
  });

  return {
    locationId,
    from: range.start.toISOString(),
    to: range.end.toISOString(),
    funnel,
    menuMatrix,
    timeAnalytics,
    denisPerformance,
    competitorBenchmark,
  };
}

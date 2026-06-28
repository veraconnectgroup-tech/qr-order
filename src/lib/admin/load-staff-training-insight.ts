import { format, subDays } from "date-fns";
import {
  analyzeStaffPerformance,
  buildStaffLeaderboard,
  buildTrainingRecommendations,
  generateStaffTrainingInsights,
  summarizeStaffTrainingInsights,
  type AllergyAlert,
  type FrustrationEvent,
  type HandoffStat,
  type IdleTableEvent,
  type StaffLeaderboardEntry,
  type StaffPerformanceInsight,
  type StaffPerformanceStat,
  type TrainingInsight,
  type TrainingRecommendation,
  type UpsellStat,
  type WaitTimeStat,
} from "@/lib/admin/staff-training-insights";
import { buildFeedbackTrainingInsights } from "@/lib/denis/platform/feedback-intelligence";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

export type StaffTrainingSnapshot = {
  locationId: string;
  locationName: string;
  periodDays: number;
  fromDate: string;
  toDate: string;
  insights: TrainingInsight[];
  summary: ReturnType<typeof summarizeStaffTrainingInsights>;
  staffPerformance: StaffPerformanceInsight[];
  recommendations: TrainingRecommendation[];
  leaderboard: StaffLeaderboardEntry[];
};

const SESSION_LIMIT = 200;
const ORDER_LIMIT = 500;
const DEFAULT_PREP_TARGET_MINUTES = 15;

type OrderRow = {
  id: string;
  status: string;
  accepted_at: string | null;
  preparing_at: string | null;
  delivered_at: string | null;
  created_by_staff_id: string | null;
  session_id: string | null;
  tip_amount: number | null;
  tip_staff_id: string | null;
  order_items: Array<{
    product_name: string;
    menu_section: string | null;
  }> | null;
};

type WaiterCallRow = {
  id: string;
  table_id: string;
  created_at: string;
  acknowledged_at: string | null;
};

type TableRow = {
  id: string;
  assigned_staff_id: string | null;
};

type FeedbackRow = {
  session_id: string | null;
  sentiment: string | null;
  rating: number;
  comment?: string | null;
  category?: string | null;
  created_at?: string | null;
};

type StaffRow = {
  id: string;
  name: string;
  role: string;
};

function prepMinutesForOrder(order: OrderRow): number | null {
  if (order.status !== "delivered" || !order.delivered_at) return null;
  const startAt = order.preparing_at ?? order.accepted_at;
  if (!startAt) return null;

  const deliveredMs = Date.parse(order.delivered_at);
  const startMs = Date.parse(startAt);
  if (!Number.isFinite(deliveredMs) || !Number.isFinite(startMs)) return null;

  return Math.max(0, Math.round((deliveredMs - startMs) / 60_000));
}

function buildWaitTimeStats(orders: OrderRow[]): WaitTimeStat[] {
  const buckets = new Map<
    string,
    { totalMinutes: number; orderCount: number }
  >();

  for (const order of orders) {
    const prepMinutes = prepMinutesForOrder(order);
    if (prepMinutes == null) continue;

    for (const item of order.order_items ?? []) {
      const name = item.product_name?.trim();
      if (!name) continue;

      const bucket = buckets.get(name) ?? { totalMinutes: 0, orderCount: 0 };
      bucket.totalMinutes += prepMinutes;
      bucket.orderCount += 1;
      buckets.set(name, bucket);
    }
  }

  return [...buckets.entries()]
    .map(([productName, bucket]) => ({
      productName,
      orderCount: bucket.orderCount,
      avgMinutes: Math.round(bucket.totalMinutes / bucket.orderCount),
      targetMinutes: DEFAULT_PREP_TARGET_MINUTES,
      frustrationCount: 0,
    }))
    .sort((a, b) => b.orderCount - a.orderCount);
}

function parseStaffAlert(row: DenisTimelineRow): {
  kind: string;
  sessionId: string;
  idleMinutes: number | null;
  isNearMiss?: boolean;
} | null {
  if (row.event_type !== "staff.proactive.alert") return null;
  const payload = row.payload as Record<string, unknown>;
  const kind = typeof payload.kind === "string" ? payload.kind : "";
  const idleMinutes =
    typeof payload.idleMinutes === "number" ? payload.idleMinutes : null;
  const isNearMiss =
    payload.isNearMiss === true || payload.severity === "near_miss";

  return {
    kind,
    sessionId: row.ai_session_id,
    idleMinutes,
    isNearMiss,
  };
}

function attachFrustrationToWaitStats(
  waitTimes: WaitTimeStat[],
  frustrationEvents: FrustrationEvent[]
): WaitTimeStat[] {
  if (waitTimes.length === 0 || frustrationEvents.length === 0) {
    return waitTimes;
  }

  const frustrationByProduct = new Map<string, number>();
  for (const event of frustrationEvents) {
    const name = event.productName?.trim();
    if (!name) continue;
    frustrationByProduct.set(name, (frustrationByProduct.get(name) ?? 0) + 1);
  }

  return waitTimes.map((stat) => ({
    ...stat,
    frustrationCount:
      frustrationByProduct.get(stat.productName) ??
      (stat.orderCount >= frustrationEvents.length
        ? frustrationEvents.length
        : 0),
  }));
}

function countHandoffs(rows: DenisTimelineRow[]): number {
  let count = 0;
  for (const row of rows) {
    if (
      row.event_type !== "act.committed" &&
      row.event_type !== "handoff.committed"
    ) {
      continue;
    }
    const payload = row.payload as Record<string, unknown>;
    const skill = payload.skill ?? payload.kind;
    if (skill === "handoff.waiter" || payload.handoffKind === "waiter") {
      count += 1;
    }
  }
  return count;
}

function buildHandoffStats(
  timelineRows: DenisTimelineRow[],
  sessionCount: number
): HandoffStat[] {
  if (sessionCount === 0) return [];
  return [
    {
      totalSessions: sessionCount,
      handoffCount: countHandoffs(timelineRows),
    },
  ];
}

function buildStaffPerformanceStats(input: {
  staffRows: StaffRow[];
  orders: OrderRow[];
  waiterCalls: WaiterCallRow[];
  tables: TableRow[];
  feedbackRows: FeedbackRow[];
  sessionToStaffId: Map<string, string>;
}): StaffPerformanceStat[] {
  const tableStaff = new Map(
    input.tables.map((row) => [row.id, row.assigned_staff_id])
  );

  const buckets = new Map<
    string,
    {
      orderCount: number;
      responseTotalMinutes: number;
      responseSamples: number;
      complaintCount: number;
    }
  >();

  for (const member of input.staffRows) {
    buckets.set(member.id, {
      orderCount: 0,
      responseTotalMinutes: 0,
      responseSamples: 0,
      complaintCount: 0,
    });
  }

  for (const order of input.orders) {
    const staffId = order.created_by_staff_id;
    if (!staffId) continue;
    const bucket = buckets.get(staffId);
    if (!bucket) continue;
    bucket.orderCount += 1;
  }

  for (const call of input.waiterCalls) {
    const staffId = tableStaff.get(call.table_id);
    if (!staffId || !call.acknowledged_at) continue;
    const bucket = buckets.get(staffId);
    if (!bucket) continue;

    const createdMs = Date.parse(call.created_at);
    const ackMs = Date.parse(call.acknowledged_at);
    if (!Number.isFinite(createdMs) || !Number.isFinite(ackMs)) continue;

    bucket.responseTotalMinutes += Math.max(
      0,
      Math.round((ackMs - createdMs) / 60_000)
    );
    bucket.responseSamples += 1;
  }

  for (const feedback of input.feedbackRows) {
    if (feedback.sentiment !== "negative" && feedback.rating >= 3) continue;
    const staffId =
      (feedback.session_id
        ? input.sessionToStaffId.get(feedback.session_id)
        : null) ?? null;
    if (!staffId) continue;
    const bucket = buckets.get(staffId);
    if (!bucket) continue;
    bucket.complaintCount += 1;
  }

  return input.staffRows.map((member) => {
    const bucket = buckets.get(member.id) ?? {
      orderCount: 0,
      responseTotalMinutes: 0,
      responseSamples: 0,
      complaintCount: 0,
    };
    return {
      staffId: member.id,
      staffName: member.name,
      orderCount: bucket.orderCount,
      avgResponseMinutes:
        bucket.responseSamples > 0
          ? Math.round(bucket.responseTotalMinutes / bucket.responseSamples)
          : 0,
      complaintCount: bucket.complaintCount,
    };
  });
}

function parseLeaderboardOptIn(config: unknown): Set<string> {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return new Set();
  }
  const raw = (config as Record<string, unknown>).staffLeaderboardOptIn;
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.filter((id): id is string => typeof id === "string"));
}

async function loadTimelineEvents(
  admin: SupabaseClient,
  input: { locationId: string; fromIso: string; toIso: string }
): Promise<DenisTimelineRow[]> {
  const { data: sessionRows, error: sessionError } = await admin
    .from("ai_sessions")
    .select("id")
    .eq("location_id", input.locationId)
    .gte("created_at", input.fromIso)
    .lte("created_at", input.toIso)
    .order("created_at", { ascending: false })
    .limit(SESSION_LIMIT);

  if (sessionError) {
    logger.warn("loadStaffTrainingSnapshot sessions failed", {
      locationId: input.locationId,
      error: sessionError.message,
    });
    return [];
  }

  const sessionIds = ((sessionRows ?? []) as Array<{ id: string }>).map(
    (row) => row.id
  );
  if (sessionIds.length === 0) return [];

  const { data, error } = await admin
    .from("denis_timeline")
    .select(
      "id, ai_session_id, seq, event_type, payload, trace_id, context_hash, created_at"
    )
    .in("ai_session_id", sessionIds)
    .gte("created_at", input.fromIso)
    .lte("created_at", input.toIso)
    .limit(5000);

  if (error) {
    logger.warn("loadStaffTrainingSnapshot timeline failed", {
      locationId: input.locationId,
      error: error.message,
    });
    return [];
  }

  return (data ?? []) as DenisTimelineRow[];
}

function buildTimelineAggregates(rows: DenisTimelineRow[]): {
  frustrationEvents: FrustrationEvent[];
  allergyAlerts: AllergyAlert[];
  idleTableEvents: IdleTableEvent[];
} {
  const frustrationEvents: FrustrationEvent[] = [];
  const allergyAlerts: AllergyAlert[] = [];
  const idleTableEvents: IdleTableEvent[] = [];

  for (const row of rows) {
    const alert = parseStaffAlert(row);
    if (!alert) continue;

    if (alert.kind === "staff_frustrated_guest") {
      frustrationEvents.push({ sessionId: alert.sessionId });
    }

    if (alert.kind === "staff_allergy") {
      allergyAlerts.push({
        sessionId: alert.sessionId,
        isNearMiss: alert.isNearMiss,
      });
    }

    if (
      alert.kind === "staff_table_idle" ||
      alert.kind === "staff_attention_escalation"
    ) {
      idleTableEvents.push({
        sessionId: alert.sessionId,
        idleMinutes: alert.idleMinutes ?? 10,
      });
    }
  }

  return { frustrationEvents, allergyAlerts, idleTableEvents };
}

async function loadDeliveredOrders(
  admin: SupabaseClient,
  input: { locationId: string; fromIso: string; toIso: string }
): Promise<OrderRow[]> {
  const { data, error } = await admin
    .from("orders")
    .select(
      "id, status, accepted_at, preparing_at, delivered_at, created_by_staff_id, session_id, tip_amount, tip_staff_id, order_items(product_name, menu_section)"
    )
    .eq("location_id", input.locationId)
    .eq("status", "delivered")
    .gte("delivered_at", input.fromIso)
    .lte("delivered_at", input.toIso)
    .limit(ORDER_LIMIT);

  if (error) {
    logger.warn("loadStaffTrainingSnapshot orders failed", {
      locationId: input.locationId,
      error: error.message,
    });
    return [];
  }

  return (data ?? []) as OrderRow[];
}

async function loadUpsellStats(
  admin: SupabaseClient,
  input: { locationId: string; fromIso: string; toIso: string }
): Promise<UpsellStat[]> {
  const fromDate = format(new Date(input.fromIso), "yyyy-MM-dd");
  const toDate = format(new Date(input.toIso), "yyyy-MM-dd");

  const [{ data: rollupRows }, { count: sessionCount }] = await Promise.all([
    admin
      .from("experience_analytics_daily" as never)
      .select("by_nudge_kind")
      .eq("location_id", input.locationId)
      .gte("metric_date", fromDate)
      .lte("metric_date", toDate),
    admin
      .from("ai_sessions")
      .select("id", { count: "exact", head: true })
      .eq("location_id", input.locationId)
      .gte("created_at", input.fromIso)
      .lte("created_at", input.toIso),
  ]);

  let denisDessertNudges = 0;
  for (const row of (rollupRows ?? []) as Array<{
    by_nudge_kind?: Record<string, number>;
  }>) {
    denisDessertNudges += row.by_nudge_kind?.dessert_nudge ?? 0;
  }

  return [
    {
      totalSessions: sessionCount ?? 0,
      denisDessertNudges,
      staffDessertOffers: 0,
    },
  ];
}

function enrichFrustrationWithProducts(
  frustrationEvents: FrustrationEvent[],
  orders: OrderRow[]
): FrustrationEvent[] {
  if (frustrationEvents.length === 0) return frustrationEvents;

  const productBySession = new Map<string, string>();
  for (const order of orders) {
    const primary = order.order_items?.[0]?.product_name?.trim();
    if (!primary) continue;
    productBySession.set(order.id, primary);
  }

  return frustrationEvents.map((event, index) => ({
    ...event,
    productName:
      event.productName ??
      [...productBySession.values()][index % productBySession.size] ??
      null,
  }));
}

function buildTipsByStaffId(orders: OrderRow[]): Record<string, number> {
  const tips: Record<string, number> = {};
  for (const order of orders) {
    if (!order.tip_staff_id || !order.tip_amount) continue;
    tips[order.tip_staff_id] =
      (tips[order.tip_staff_id] ?? 0) + Number(order.tip_amount);
  }
  return tips;
}

function buildSessionToStaffMap(orders: OrderRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const order of orders) {
    if (!order.session_id) continue;
    if (order.created_by_staff_id) {
      map.set(order.session_id, order.created_by_staff_id);
    }
  }
  return map;
}

async function loadStaffPerformanceContext(
  admin: SupabaseClient,
  input: { locationId: string; orgId: string; fromIso: string; toIso: string }
): Promise<{
  staffRows: StaffRow[];
  orders: OrderRow[];
  waiterCalls: WaiterCallRow[];
  tables: TableRow[];
  feedbackRows: FeedbackRow[];
  optedInStaffIds: Set<string>;
}> {
  const { data: locationRow } = await admin
    .from("locations")
    .select("ai_concierge_config")
    .eq("id", input.locationId)
    .maybeSingle();

  const optedInStaffIds = parseLeaderboardOptIn(
    (locationRow as { ai_concierge_config?: unknown } | null)
      ?.ai_concierge_config
  );

  const [
    { data: staffRows },
    orders,
    { data: waiterCalls },
    { data: tables },
    { data: feedbackRows },
  ] = await Promise.all([
    admin
      .from("staff")
      .select("id, name, role")
      .eq("org_id", input.orgId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .in("role", ["waiter", "staff", "manager"]),
    loadDeliveredOrders(admin, input),
    admin
      .from("waiter_calls")
      .select("id, table_id, created_at, acknowledged_at")
      .eq("location_id", input.locationId)
      .gte("created_at", input.fromIso)
      .lte("created_at", input.toIso)
      .not("acknowledged_at", "is", null)
      .limit(500),
    admin
      .from("tables")
      .select("id, assigned_staff_id")
      .eq("location_id", input.locationId)
      .is("deleted_at", null),
    admin
      .from("order_feedback")
      .select("session_id, sentiment, rating")
      .eq("location_id", input.locationId)
      .gte("created_at", input.fromIso)
      .lte("created_at", input.toIso)
      .limit(500),
  ]);

  return {
    staffRows: (staffRows ?? []) as StaffRow[],
    orders,
    waiterCalls: (waiterCalls ?? []) as WaiterCallRow[],
    tables: (tables ?? []) as TableRow[],
    feedbackRows: (feedbackRows ?? []) as FeedbackRow[],
    optedInStaffIds,
  };
}

function buildRatingsByStaffId(
  feedbackRows: FeedbackRow[],
  sessionToStaffId: Map<string, string>
): Record<string, { sum: number; count: number }> {
  const ratings: Record<string, { sum: number; count: number }> = {};
  for (const row of feedbackRows) {
    if (!row.session_id) continue;
    const staffId = sessionToStaffId.get(row.session_id);
    if (!staffId) continue;
    const bucket = ratings[staffId] ?? { sum: 0, count: 0 };
    bucket.sum += row.rating;
    bucket.count += 1;
    ratings[staffId] = bucket;
  }
  return ratings;
}

export async function loadStaffTrainingSnapshot(
  admin: SupabaseClient,
  input: {
    locationId: string;
    orgId?: string;
    periodDays?: number;
    includePriorTrend?: boolean;
  }
): Promise<StaffTrainingSnapshot | null> {
  const periodDays = input.periodDays ?? 30;
  const toDate = format(new Date(), "yyyy-MM-dd");
  const fromDate = format(subDays(new Date(), periodDays - 1), "yyyy-MM-dd");
  const fromIso = subDays(new Date(), periodDays).toISOString();
  const toIso = new Date().toISOString();

  const { data: locationRow } = await admin
    .from("locations")
    .select("id, name, org_id")
    .eq("id", input.locationId)
    .maybeSingle();

  if (!locationRow) return null;

  const orgId =
    input.orgId ?? (locationRow as { org_id: string }).org_id;

  const [orders, timelineRows, upsellConversions, perfContext] =
    await Promise.all([
      loadDeliveredOrders(admin, {
        locationId: input.locationId,
        fromIso,
        toIso,
      }),
      loadTimelineEvents(admin, {
        locationId: input.locationId,
        fromIso,
        toIso,
      }),
      loadUpsellStats(admin, {
        locationId: input.locationId,
        fromIso,
        toIso,
      }),
      loadStaffPerformanceContext(admin, {
        locationId: input.locationId,
        orgId,
        fromIso,
        toIso,
      }),
    ]);

  const timelineAgg = buildTimelineAggregates(timelineRows);
  const frustrationEvents = enrichFrustrationWithProducts(
    timelineAgg.frustrationEvents,
    orders
  );
  const waitTimes = attachFrustrationToWaitStats(
    buildWaitTimeStats(orders),
    frustrationEvents
  );
  const handoffStats = buildHandoffStats(
    timelineRows,
    upsellConversions[0]?.totalSessions ?? 0
  );

  const insights = generateStaffTrainingInsights({
    frustrationEvents,
    waitTimes,
    allergyAlerts: timelineAgg.allergyAlerts,
    idleTableEvents: timelineAgg.idleTableEvents,
    upsellConversions,
    handoffStats,
    periodDays,
  });

  const feedbackTrainingInsights = buildFeedbackTrainingInsights({
    feedbacks: perfContext.feedbackRows.map((row) => ({
      comment: row.comment ?? null,
      sentiment:
        row.sentiment === "positive" ||
        row.sentiment === "neutral" ||
        row.sentiment === "negative"
          ? row.sentiment
          : "neutral",
      category:
        row.category === "food" ||
        row.category === "service" ||
        row.category === "wait_time" ||
        row.category === "other"
          ? row.category
          : null,
      createdAt: row.created_at ?? new Date().toISOString(),
    })),
    lookbackDays: periodDays,
    periodDays,
  });

  const mergedInsights = [...insights, ...feedbackTrainingInsights];

  const sessionToStaffId = buildSessionToStaffMap(perfContext.orders);
  const performanceStats = buildStaffPerformanceStats({
    staffRows: perfContext.staffRows,
    orders: perfContext.orders,
    waiterCalls: perfContext.waiterCalls,
    tables: perfContext.tables,
    feedbackRows: perfContext.feedbackRows,
    sessionToStaffId,
  });
  const staffPerformance = analyzeStaffPerformance(performanceStats);
  const recommendations = buildTrainingRecommendations({
    insights: mergedInsights,
    staffPerformance,
    periodDays,
  });
  const leaderboard = buildStaffLeaderboard({
    performance: performanceStats,
    tipsByStaffId: buildTipsByStaffId(perfContext.orders),
    ratingsByStaffId: buildRatingsByStaffId(
      perfContext.feedbackRows,
      sessionToStaffId
    ),
    optedInStaffIds: perfContext.optedInStaffIds,
  });

  let priorInsights: TrainingInsight[] | undefined;
  if (input.includePriorTrend) {
    const priorFromIso = subDays(new Date(), periodDays * 2).toISOString();
    const priorToIso = fromIso;
    const [priorOrders, priorTimeline, priorUpsell] = await Promise.all([
      loadDeliveredOrders(admin, {
        locationId: input.locationId,
        fromIso: priorFromIso,
        toIso: priorToIso,
      }),
      loadTimelineEvents(admin, {
        locationId: input.locationId,
        fromIso: priorFromIso,
        toIso: priorToIso,
      }),
      loadUpsellStats(admin, {
        locationId: input.locationId,
        fromIso: priorFromIso,
        toIso: priorToIso,
      }),
    ]);
    const priorAgg = buildTimelineAggregates(priorTimeline);
    priorInsights = generateStaffTrainingInsights({
      frustrationEvents: enrichFrustrationWithProducts(
        priorAgg.frustrationEvents,
        priorOrders
      ),
      waitTimes: attachFrustrationToWaitStats(
        buildWaitTimeStats(priorOrders),
        priorAgg.frustrationEvents
      ),
      allergyAlerts: priorAgg.allergyAlerts,
      idleTableEvents: priorAgg.idleTableEvents,
      upsellConversions: priorUpsell,
      handoffStats: buildHandoffStats(
        priorTimeline,
        priorUpsell[0]?.totalSessions ?? 0
      ),
      periodDays,
    });
  }

  const summary = summarizeStaffTrainingInsights({
    insights: mergedInsights,
    priorInsights,
    periodDays,
  });

  return {
    locationId: input.locationId,
    locationName: (locationRow as { name: string }).name,
    periodDays,
    fromDate,
    toDate,
    insights: mergedInsights,
    summary,
    staffPerformance,
    recommendations,
    leaderboard,
  };
}

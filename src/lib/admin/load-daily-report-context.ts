import type { SupabaseClient } from "@supabase/supabase-js";
import {
  aggregateProductRollupFromItems,
  buildDailyReport,
  denisMetricsFromHealth,
  type DailyReport,
  type DailyReportOrderRow,
  type DailyReportSessionRow,
} from "@/lib/admin/build-daily-report";
import type {
  BuildDenisShiftRecapInput,
  DenisShiftDessertWindowStats,
  DenisShiftNotificationRow,
  DenisShiftQuestionRow,
  DenisShiftStationStateRow,
  DenisShiftWaiterCallRow,
  DenisShiftBusObligationRow,
} from "@/lib/admin/denis-shift-report";
import {
  aggregateDessertWindowStats,
  aggregateReturningGuestStats,
  aggregateServiceRecoveryStats,
} from "@/lib/admin/denis-shift-report";
import { loadLocationRhythmPriors } from "@/lib/denis/config/load-rhythm-priors";
import {
  locationPrepTimePriorsFromJson,
  parseLocationPrepTimePriors,
} from "@/lib/denis/config/prep-time-priors";
import { loadDenisHealthMetrics } from "@/lib/denis/monitoring";
import type { FeedbackRow } from "@/lib/denis/platform/feedback-intelligence";
import { loadOpenSuspiciousFlags } from "@/lib/loss-prevention/load-open-suspicious-flags";
import { loadLocationFeedbackRows } from "@/lib/denis/platform/load-location-feedback-rows";
import {
  loadEightySixEventsForRange,
  type EightySixEvent,
} from "@/lib/products/eighty-six";

function localDateInTimezone(timezone: string | null, now = new Date()): string {
  const tz = timezone?.trim() || "Europe/Berlin";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function weekdayLabel(timezone: string | null, now = new Date()): string {
  const tz = timezone?.trim() || "Europe/Berlin";
  const weekday = new Intl.DateTimeFormat("sr-RS", {
    timeZone: tz,
    weekday: "long",
  }).format(now);
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

function shiftDate(date: string, deltaDays: number): string {
  const base = new Date(`${date}T12:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return base.toISOString().slice(0, 10);
}

function dayRange(date: string): { from: string; to: string } {
  const from = `${date}T00:00:00.000Z`;
  const end = new Date(`${date}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { from, to: end.toISOString() };
}

async function sumOrderRevenue(
  admin: SupabaseClient,
  locationId: string,
  from: string,
  to: string
): Promise<number> {
  const { data } = await admin
    .from("orders")
    .select("total")
    .eq("location_id", locationId)
    .gte("created_at", from)
    .lt("created_at", to)
    .neq("status", "cancelled");

  return (data ?? []).reduce(
    (sum, row) => sum + Number((row as { total: number }).total ?? 0),
    0
  );
}

async function loadOrdersForRange(
  admin: SupabaseClient,
  locationId: string,
  from: string,
  to: string
): Promise<DailyReportOrderRow[]> {
  const { data } = await admin
    .from("orders")
    .select("id, total, created_at, session_id, guest_token")
    .eq("location_id", locationId)
    .gte("created_at", from)
    .lt("created_at", to)
    .neq("status", "cancelled");

  return (data ?? []) as DailyReportOrderRow[];
}

async function loadOrderItemsForOrders(
  admin: SupabaseClient,
  orderIds: string[]
): Promise<Array<{ productName: string; quantity: number; total: number }>> {
  if (orderIds.length === 0) return [];

  const { data } = await admin
    .from("order_items")
    .select("product_name, quantity, total")
    .in("order_id", orderIds);

  return (data ?? []).map((row) => {
    const typed = row as {
      product_name: string;
      quantity: number;
      total: number;
    };
    return {
      productName: typed.product_name,
      quantity: typed.quantity,
      total: Number(typed.total),
    };
  });
}

async function loadSessionsForRange(
  admin: SupabaseClient,
  locationId: string,
  from: string,
  to: string
): Promise<DailyReportSessionRow[]> {
  const { data } = await admin
    .from("table_sessions")
    .select("id, opened_at, denis_shared_ai_session_id, guest_token")
    .eq("location_id", locationId)
    .gte("opened_at", from)
    .lt("opened_at", to);

  return (data ?? []) as DailyReportSessionRow[];
}

function peakHourFromOrders(
  orders: DailyReportOrderRow[],
  timezone: string | null
): { peakHour: string; peakOrderCount: number } {
  const tz = timezone?.trim() || "Europe/Berlin";
  const buckets = new Map<string, number>();

  for (const order of orders) {
    const hour = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      hour12: false,
    }).format(new Date(order.created_at));
    const nextHour = String((Number(hour) + 1) % 24).padStart(2, "0");
    const label = `${hour}:00-${nextHour}:00`;
    buckets.set(label, (buckets.get(label) ?? 0) + 1);
  }

  let peakHour = "—";
  let peakOrderCount = 0;
  for (const [label, count] of buckets) {
    if (count > peakOrderCount) {
      peakHour = label;
      peakOrderCount = count;
    }
  }

  return { peakHour, peakOrderCount };
}

function slowestPrepItem(
  priors: ReturnType<typeof locationPrepTimePriorsFromJson> | null
): { name: string; avgMinutes: number } | null {
  if (!priors) return null;

  let best: { name: string; avgMinutes: number } | null = null;
  for (const prior of priors.byProduct.values()) {
    if (!best || prior.p50Minutes > best.avgMinutes) {
      best = {
        name: prior.productId,
        avgMinutes: Math.round(prior.p50Minutes),
      };
    }
  }
  return best;
}

async function resolveProductNames(
  admin: SupabaseClient,
  productIds: string[]
): Promise<Record<string, string>> {
  if (!productIds.length) return {};
  const { data } = await admin
    .from("products")
    .select("id, name")
    .in("id", productIds);

  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    map[(row as { id: string }).id] = (row as { name: string }).name;
  }
  return map;
}

async function loadGuestReturnCounts(
  admin: SupabaseClient,
  locationId: string,
  sessions: DailyReportSessionRow[]
): Promise<{
  returning: number;
  newGuests: number;
  visitCountByToken: Record<string, number>;
}> {
  const tokens = [
    ...new Set(
      sessions
        .map((row) => row.guest_token?.trim())
        .filter((token): token is string => Boolean(token))
    ),
  ];

  if (!tokens.length) {
    return { returning: 0, newGuests: sessions.length, visitCountByToken: {} };
  }

  const { data } = await admin
    .from("denis_guest_memory" as never)
    .select("guest_token, visit_count")
    .eq("location_id", locationId)
    .in("guest_token", tokens);

  const visitByToken = new Map<string, number>();
  const visitCountByToken: Record<string, number> = {};
  for (const row of data ?? []) {
    const typed = row as { guest_token: string; visit_count: number };
    visitByToken.set(typed.guest_token, typed.visit_count);
    visitCountByToken[typed.guest_token] = typed.visit_count;
  }

  let returning = 0;
  let newGuests = 0;
  const seen = new Set<string>();

  for (const session of sessions) {
    const token = session.guest_token?.trim();
    if (!token) {
      newGuests += 1;
      continue;
    }
    if (seen.has(token)) continue;
    seen.add(token);

    const visits = visitByToken.get(token);
    if (visits != null && visits > 1) returning += 1;
    else newGuests += 1;
  }

  return { returning, newGuests, visitCountByToken };
}

async function loadDenisDayMetrics(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    sessions: DailyReportSessionRow[];
    date: string;
  }
): Promise<Partial<DailyReport["sections"]["denis"]>> {
  const aiSessionIds = [
    ...new Set(
      input.sessions
        .map((row) => row.denis_shared_ai_session_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  let creditsBurned = 0;
  if (aiSessionIds.length) {
    const { data } = await admin
      .from("ai_sessions")
      .select("credits_used")
      .eq("org_id", input.orgId)
      .in("id", aiSessionIds);
    creditsBurned = (data ?? []).reduce(
      (sum, row) =>
        sum + Number((row as { credits_used: number }).credits_used ?? 0),
      0
    );
  }

  const { data: rollup } = await admin
    .from("experience_analytics_daily" as never)
    .select("nudge_impressions, offer_conversions")
    .eq("location_id", input.locationId)
    .eq("insight_date", input.date)
    .maybeSingle();

  const row = rollup as {
    nudge_impressions?: number;
    offer_conversions?: number;
  } | null;

  const nudges = Number(row?.nudge_impressions ?? 0);
  const conversions = Number(row?.offer_conversions ?? 0);

  return {
    sessionsHandled: input.sessions.length,
    upsellRevenue: 0,
    upsellConversionRate: nudges ? conversions / nudges : 0,
    proactiveNudgesSent: nudges,
    nudgeAcceptRate: nudges ? conversions / nudges : 0,
    creditsBurned,
  };
}

async function loadTableNamesForLocation(
  admin: SupabaseClient,
  locationId: string
): Promise<Record<string, string>> {
  const { data } = await admin
    .from("tables")
    .select("id, name")
    .eq("location_id", locationId);

  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    map[(row as { id: string }).id] = (row as { name: string }).name;
  }
  return map;
}

async function loadStationQuestionsForRange(
  admin: SupabaseClient,
  locationId: string,
  from: string,
  to: string
): Promise<DenisShiftQuestionRow[]> {
  const { data } = await admin
    .from("station_questions")
    .select(
      "station, status, asked_at, answered_at, expires_at, table_id, order_id"
    )
    .eq("location_id", locationId)
    .gte("asked_at", from)
    .lt("asked_at", to);

  return (data ?? []) as DenisShiftQuestionRow[];
}

async function loadStaffNotificationsForRange(
  admin: SupabaseClient,
  locationId: string,
  from: string,
  to: string
): Promise<DenisShiftNotificationRow[]> {
  const { data } = await admin
    .from("denis_staff_notifications")
    .select("type, priority, table_id, created_at, message, read_at")
    .eq("location_id", locationId)
    .gte("created_at", from)
    .lt("created_at", to);

  return (data ?? []) as DenisShiftNotificationRow[];
}

async function loadWaiterCallsForRange(
  admin: SupabaseClient,
  locationId: string,
  from: string,
  to: string
): Promise<DenisShiftWaiterCallRow[]> {
  const { data } = await admin
    .from("waiter_calls")
    .select("table_id, created_at")
    .eq("location_id", locationId)
    .gte("created_at", from)
    .lt("created_at", to);

  return (data ?? []) as DenisShiftWaiterCallRow[];
}

async function loadStationStatesForRange(
  admin: SupabaseClient,
  locationId: string,
  from: string,
  to: string
): Promise<DenisShiftStationStateRow[]> {
  const { data } = await admin
    .from("order_station_states")
    .select("station, in_prep_at, ready_at")
    .eq("location_id", locationId)
    .gte("in_prep_at", from)
    .lt("in_prep_at", to);

  return (data ?? []) as DenisShiftStationStateRow[];
}

async function loadDessertWindowStatsForDay(
  admin: SupabaseClient,
  locationId: string,
  date: string
): Promise<DenisShiftDessertWindowStats> {
  const { data } = await admin
    .from("experience_analytics_daily" as never)
    .select("by_nudge_kind, by_outcome, offer_conversions")
    .eq("location_id", locationId)
    .eq("insight_date", date)
    .maybeSingle();

  const row = data as {
    by_nudge_kind?: Record<string, number>;
    by_outcome?: Record<string, number>;
    offer_conversions?: number;
  } | null;

  return aggregateDessertWindowStats({
    byNudgeKind: row?.by_nudge_kind,
    byOutcome: row?.by_outcome,
    valueEuros: 0,
  });
}

async function loadBusObligationsForRange(
  admin: SupabaseClient,
  locationId: string,
  from: string,
  to: string
): Promise<DenisShiftBusObligationRow[]> {
  const { data } = await admin
    .from("table_bus_obligations")
    .select("table_id, paid_at, bussed_at, status")
    .eq("location_id", locationId)
    .gte("paid_at", from)
    .lt("paid_at", to);

  return (data ?? []) as DenisShiftBusObligationRow[];
}

async function loadDenisShiftInput(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    from: string;
    to: string;
    kitchenFallbackPrepMinutes: number | null;
    date: string;
    orders: DailyReportOrderRow[];
    sessions: DailyReportSessionRow[];
    visitCountByToken: Record<string, number>;
  }
): Promise<BuildDenisShiftRecapInput> {
  const [
    stationQuestions,
    staffNotifications,
    waiterCalls,
    stationStates,
    tableNames,
    eightySixEvents,
    dessertWindow,
    busObligations,
  ] = await Promise.all([
    loadStationQuestionsForRange(
      admin,
      input.locationId,
      input.from,
      input.to
    ),
    loadStaffNotificationsForRange(
      admin,
      input.locationId,
      input.from,
      input.to
    ),
    loadWaiterCallsForRange(admin, input.locationId, input.from, input.to),
    loadStationStatesForRange(admin, input.locationId, input.from, input.to),
    loadTableNamesForLocation(admin, input.locationId),
    loadEightySixEventsForRange(admin, {
      orgId: input.orgId,
      locationId: input.locationId,
      from: input.from,
      to: input.to,
    }),
    loadDessertWindowStatsForDay(admin, input.locationId, input.date),
    loadBusObligationsForRange(
      admin,
      input.locationId,
      input.from,
      input.to
    ),
  ]);

  return {
    stationQuestions,
    staffNotifications,
    waiterCalls,
    stationStates,
    tableNames,
    kitchenFallbackPrepMinutes: input.kitchenFallbackPrepMinutes,
    eightySixEvents: eightySixEvents.map((event: EightySixEvent) => ({
      productName: event.productName,
      at: event.at,
    })),
    dessertWindow,
    returningGuests: aggregateReturningGuestStats({
      orders: input.orders,
      sessions: input.sessions,
      visitCountByToken: input.visitCountByToken,
    }),
    serviceRecovery: aggregateServiceRecoveryStats(staffNotifications),
    busObligations,
  };
}

export async function loadDailyReportForLocation(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    now?: Date;
  }
): Promise<DailyReport | null> {
  const { data: location } = await admin
    .from("locations")
    .select("id, name, timezone, organization:organizations!inner(currency)")
    .eq("id", input.locationId)
    .maybeSingle();

  if (!location) return null;

  const timezone = (location as { timezone: string | null }).timezone;
  const now = input.now ?? new Date();
  const date = localDateInTimezone(timezone, now);
  const range = dayRange(date);
  const yesterdayRange = dayRange(shiftDate(date, -1));
  const lastWeekRange = dayRange(shiftDate(date, -7));

  const [
    orders,
    sessions,
    revenueYesterday,
    revenueLastWeekSameDay,
    feedbackRows,
    rhythmPriors,
    healthMetrics,
  ] = await Promise.all([
    loadOrdersForRange(admin, input.locationId, range.from, range.to),
    loadSessionsForRange(admin, input.locationId, range.from, range.to),
    sumOrderRevenue(
      admin,
      input.locationId,
      yesterdayRange.from,
      yesterdayRange.to
    ),
    sumOrderRevenue(
      admin,
      input.locationId,
      lastWeekRange.from,
      lastWeekRange.to
    ),
    loadLocationFeedbackRows(admin, {
      locationId: input.locationId,
      lookbackDays: 1,
    }),
    loadLocationRhythmPriors(admin, input.locationId),
    loadDenisHealthMetrics({ locationId: input.locationId }),
  ]);

  const [denisDay, guestCounts] = await Promise.all([
    loadDenisDayMetrics(admin, {
      orgId: input.orgId,
      locationId: input.locationId,
      sessions,
      date,
    }),
    loadGuestReturnCounts(admin, input.locationId, sessions),
  ]);

  const prepJson = parseLocationPrepTimePriors(rhythmPriors?.priors.prepTime);
  const prepPriors = prepJson ? locationPrepTimePriorsFromJson(prepJson) : null;
  let slowest = slowestPrepItem(prepPriors);
  if (slowest) {
    const names = await resolveProductNames(admin, [slowest.name]);
    slowest = { ...slowest, name: names[slowest.name] ?? slowest.name };
  }

  const stationKitchen = prepPriors?.byStation.get("kitchen");
  const { peakHour, peakOrderCount } = peakHourFromOrders(orders, timezone);
  const kitchenFallbackPrepMinutes = stationKitchen
    ? Math.round(stationKitchen.p50)
    : null;

  const denisShift = await loadDenisShiftInput(admin, {
    orgId: input.orgId,
    locationId: input.locationId,
    from: range.from,
    to: range.to,
    date,
    kitchenFallbackPrepMinutes,
    orders,
    sessions,
    visitCountByToken: guestCounts.visitCountByToken,
  });

  const orderItems = await loadOrderItemsForOrders(
    admin,
    orders.map((row) => row.id)
  );
  const productRollup = aggregateProductRollupFromItems(orderItems);

  const feedback: FeedbackRow[] = feedbackRows
    .filter(
      (row) =>
        row.createdAt >= range.from && row.createdAt < range.to
    )
    .map((row) => ({
      rating: row.rating,
      sentiment: row.sentiment,
      category: row.category,
      createdAt: row.createdAt,
    }));

  const currency =
    (
      location as {
        organization?: { currency?: string | null };
      }
    ).organization?.currency ?? "RSD";

  const suspiciousFlags = await loadOpenSuspiciousFlags(admin, input.locationId, {
    sinceIso: range.from,
    limit: 50,
  });

  return buildDailyReport({
    date,
    venueName: (location as { name: string }).name,
    weekdayLabel: weekdayLabel(timezone, now),
    currencyLabel: currency,
    orders,
    sessions,
    feedback,
    denisMetrics: denisMetricsFromHealth(healthMetrics, denisDay),
    revenueYesterday,
    revenueLastWeekSameDay,
    prepTimeAvgMinutes: kitchenFallbackPrepMinutes,
    slowestItem: slowest,
    peakHour,
    peakOrderCount,
    returningGuestSessions: guestCounts.returning,
    newGuestSessions: guestCounts.newGuests,
    denisShift,
    productRollup,
    suspiciousFlags,
  });
}

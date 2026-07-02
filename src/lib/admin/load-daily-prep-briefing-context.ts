import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildDailyPrepBriefing,
  type BuildDailyPrepBriefingInput,
  type DailyPrepBriefing,
  type DailyPrepGuestMemoryRow,
} from "@/lib/admin/build-daily-prep-briefing";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { loadLocationRhythmPriors } from "@/lib/denis/config/load-rhythm-priors";
import {
  localSlotFromDate,
  resolveRhythmPriors,
  rhythmSlotKey,
} from "@/lib/denis/config/resolve-rhythm-priors";
import {
  forecastDemand,
  formatPrepBriefingLines,
  type DemandForecastEvent,
  type OrderRow,
  type Reservation,
} from "@/lib/denis/intelligence/demand-forecast";
import { analyzeFeedbackTrends } from "@/lib/denis/platform/feedback-intelligence";
import { loadLocationFeedbackRows } from "@/lib/denis/platform/load-location-feedback-rows";
import { loadVenueInventorySnapshot } from "@/lib/denis/intelligence/load-venue-inventory";
import { formatMorningPrepReplenishment } from "@/lib/denis/intelligence/inventory-awareness";
import { yesterdayBusinessDate } from "@/lib/fiscal/daily-closing";
import { parseEventConfig } from "@/lib/denis/venue/ops/event-mode";
import { buildRhythmRushHourLines } from "@/lib/admin/prep-briefing-rhythm-rush";
import { aggregateRepeatingStationIssues } from "@/lib/admin/prep-briefing-station-issues";
import { loadEightySixEventsForRange } from "@/lib/products/eighty-six";

const DAY_NAMES_SR = [
  "Nedelja",
  "Ponedeljak",
  "Utorak",
  "Sreda",
  "Četvrtak",
  "Petak",
  "Subota",
];

function localDateInTimezone(timezone: string | null, now = new Date()): string {
  const tz = timezone?.trim() || "Europe/Berlin";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function weekdayInTimezone(timezone: string | null, now = new Date()): number {
  const tz = timezone?.trim() || "Europe/Berlin";
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  }).format(now);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekday] ?? now.getUTCDay();
}

function yesterdayBounds(timezone: string | null, now = new Date()) {
  const y = new Date(now.getTime() - 86_400_000);
  const date = localDateInTimezone(timezone, y);
  const start = `${date}T00:00:00.000Z`;
  const endDate = new Date(`${date}T00:00:00.000Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  return { date, start, end: endDate.toISOString() };
}

async function loadYesterdayFiscalClosing(
  admin: SupabaseClient,
  locationId: string,
  timezone: string,
  now = new Date()
) {
  const businessDate = yesterdayBusinessDate(timezone, now);
  const { data } = await admin
    .from("daily_closings" as never)
    .select("order_count, total_gross, refund_count, total_tips")
    .eq("location_id", locationId)
    .eq("business_date", businessDate)
    .maybeSingle();

  const row = data as {
    order_count: number;
    total_gross: number;
    refund_count: number;
    total_tips: number;
  } | null;

  if (!row) return null;

  return {
    orderCount: Number(row.order_count),
    totalGross: Number(row.total_gross),
    refundCount: Number(row.refund_count),
  };
}

function guestLabelFromToken(guestToken: string, index: number): string {
  const suffix = guestToken.slice(-4).toUpperCase();
  if (index === 0) return `Gost ${suffix}`;
  return `Gost ${suffix}`;
}

async function loadReturningGuestRows(
  admin: SupabaseClient,
  locationId: string
): Promise<DailyPrepGuestMemoryRow[]> {
  const { data } = await admin
    .from("denis_guest_memory" as never)
    .select(
      "guest_token, visit_count, last_visit_item_names, modifier_preferences, last_feedback_sentiment, consented_at, expires_at"
    )
    .eq("location_id", locationId)
    .gte("visit_count", 1)
    .gt("expires_at", new Date().toISOString())
    .order("visit_count", { ascending: false })
    .limit(15);

  return (data ?? [])
    .map((row, index) => {
      const typed = row as {
        guest_token: string;
        visit_count: number;
        last_visit_item_names: string[];
        modifier_preferences: string[];
        last_feedback_sentiment: string | null;
        consented_at: string | null;
      };
      if (!typed.consented_at) return null;

      const isVip =
        typed.visit_count >= 5 || typed.last_feedback_sentiment === "positive";

      return {
        guestLabel: guestLabelFromToken(typed.guest_token, index),
        visitCount: typed.visit_count,
        isVip,
        lastVisitItemNames: typed.last_visit_item_names ?? [],
        modifierPreferences: typed.modifier_preferences ?? [],
      };
    })
    .filter((row): row is DailyPrepGuestMemoryRow => row != null);
}

async function loadYesterdayOrders(
  admin: SupabaseClient,
  locationId: string,
  start: string,
  end: string
) {
  const { data: orderRows } = await admin
    .from("orders")
    .select("id, total")
    .eq("location_id", locationId)
    .gte("created_at", start)
    .lte("created_at", end);

  const orderIds = (orderRows ?? []).map((row) => (row as { id: string }).id);
  if (orderIds.length === 0) {
    return {
      revenue: 0,
      items: [] as BuildDailyPrepBriefingInput["yesterdayOrders"],
    };
  }

  const { data: itemRows } = await admin
    .from("order_items")
    .select("product_id, product_name, quantity, total, order_id")
    .in("order_id", orderIds);

  const items = (itemRows ?? []).map((row) => {
    const typed = row as {
      product_id: string;
      product_name: string;
      quantity: number;
      total: number;
    };
    return {
      productId: typed.product_id,
      productName: typed.product_name,
      quantity: typed.quantity,
      total: Number(typed.total),
    };
  });

  const revenue = (orderRows ?? []).reduce(
    (sum, row) => sum + Number((row as { total: number }).total),
    0
  );

  return { revenue, items };
}

async function loadHistoricalOrderRows(
  admin: SupabaseClient,
  locationId: string,
  lookbackDays = 30
): Promise<OrderRow[]> {
  const since = new Date(Date.now() - lookbackDays * 86_400_000).toISOString();

  const { data: orderRows } = await admin
    .from("orders")
    .select("id, created_at")
    .eq("location_id", locationId)
    .gte("created_at", since);

  const orderMeta = new Map<string, string>();
  for (const row of orderRows ?? []) {
    const typed = row as { id: string; created_at: string };
    orderMeta.set(typed.id, typed.created_at);
  }

  const orderIds = [...orderMeta.keys()];
  if (orderIds.length === 0) return [];

  const { data: itemRows } = await admin
    .from("order_items")
    .select("order_id, product_id, product_name, quantity")
    .in("order_id", orderIds);

  return (itemRows ?? [])
    .map((row) => {
      const typed = row as {
        order_id: string;
        product_id: string;
        product_name: string;
        quantity: number;
      };
      const createdAt = orderMeta.get(typed.order_id);
      if (!createdAt) return null;
      return {
        productId: typed.product_id,
        productName: typed.product_name,
        quantity: typed.quantity,
        createdAt,
      };
    })
    .filter((row): row is OrderRow => row != null);
}

function reservationFromEvent(
  event: NonNullable<ReturnType<typeof parseEventConfig>>,
  date: string
): Reservation | null {
  const start = event.startTime.trim();
  const scheduledAt = start.includes("T")
    ? start
    : `${date}T${start.length === 5 ? `${start}:00` : start}:00.000Z`;

  if (!Number.isFinite(Date.parse(scheduledAt))) return null;

  return {
    partySize: event.expectedGuests,
    scheduledAt,
  };
}

function eventToForecastEvent(
  event: NonNullable<ReturnType<typeof parseEventConfig>>
): DemandForecastEvent {
  return {
    name: event.name,
    expectedGuests: event.expectedGuests,
    presetMenu: event.presetMenu,
    presetProductIds: event.presetProductIds,
    startTime: event.startTime,
  };
}

async function loadMenuChanges(
  admin: SupabaseClient,
  locationId: string,
  sinceIso: string
): Promise<string[]> {
  const { data } = await admin
    .from("products")
    .select("name, created_at, updated_at, is_available")
    .eq("location_id", locationId)
    .is("deleted_at", null)
    .gte("updated_at", sinceIso)
    .order("updated_at", { ascending: false })
    .limit(10);

  return (data ?? []).map((row) => {
    const typed = row as {
      name: string;
      created_at: string;
      updated_at: string;
      is_available: boolean;
    };
    const created = new Date(typed.created_at).getTime();
    const updated = new Date(typed.updated_at).getTime();
    if (Math.abs(updated - created) < 60_000) {
      return `Novo: ${typed.name}`;
    }
    if (!typed.is_available) {
      return `Uklonjeno/sklonjeno: ${typed.name}`;
    }
    return `Ažurirano: ${typed.name}`;
  });
}

export async function loadDailyPrepBriefingForLocation(
  admin: SupabaseClient,
  input: {
    locationId: string;
    orgId: string;
    now?: Date;
  }
): Promise<DailyPrepBriefing | null> {
  const [{ data: locationRow }, config, rhythmRow] = await Promise.all([
    admin
      .from("locations")
      .select("name, timezone, denis_event_config")
      .eq("id", input.locationId)
      .maybeSingle(),
    loadConciergeConfigForLocation(input.locationId),
    loadLocationRhythmPriors(admin, input.locationId),
  ]);

  const location = locationRow as {
    name: string;
    timezone: string | null;
    denis_event_config?: unknown;
  } | null;
  if (!location) return null;

  const now = input.now ?? new Date();
  const timezone = location.timezone ?? rhythmRow?.timezone ?? "Europe/Berlin";
  const date = localDateInTimezone(timezone, now);
  const weekday = weekdayInTimezone(timezone, now);
  const weekdayLabel = DAY_NAMES_SR[weekday] ?? "Danas";
  const yesterday = yesterdayBounds(timezone, now);

  const rhythm = resolveRhythmPriors({
    config,
    priors: rhythmRow?.priors ?? null,
    now,
    timezone,
  });

  const slotKey = rhythmSlotKey(
    localSlotFromDate(now, timezone).dow,
    localSlotFromDate(now, timezone).hour
  );
  const lunchSlotKey = rhythmSlotKey(weekday, 12);
  const peakSlot =
    rhythmRow?.priors.slots[lunchSlotKey] ??
    rhythmRow?.priors.slots[slotKey] ??
    null;

  const [
    returningGuests,
    yesterdayData,
    feedbackRows,
    unavailableRows,
    menuChanges,
    historicalOrders,
    inventorySnapshot,
    yesterdayFiscal,
    orgRow,
    yesterdayEightySixEvents,
    yesterdayStationQuestions,
  ] = await Promise.all([
    loadReturningGuestRows(admin, input.locationId),
    loadYesterdayOrders(
      admin,
      input.locationId,
      yesterday.start,
      yesterday.end
    ),
    loadLocationFeedbackRows(admin, {
      locationId: input.locationId,
      lookbackDays: 1,
    }),
    admin
      .from("products")
      .select("name")
      .eq("location_id", input.locationId)
      .eq("is_available", false)
      .is("deleted_at", null),
    loadMenuChanges(admin, input.locationId, yesterday.start),
    loadHistoricalOrderRows(admin, input.locationId, 30),
    loadVenueInventorySnapshot(admin, {
      locationId: input.locationId,
      timezone,
    }),
    loadYesterdayFiscalClosing(admin, input.locationId, timezone, now),
    admin
      .from("organizations")
      .select("currency")
      .eq("id", input.orgId)
      .maybeSingle(),
    loadEightySixEventsForRange(admin, {
      orgId: input.orgId,
      locationId: input.locationId,
      from: yesterday.start,
      to: yesterday.end,
    }),
    admin
      .from("station_questions")
      .select("station")
      .eq("location_id", input.locationId)
      .gte("asked_at", yesterday.start)
      .lt("asked_at", yesterday.end),
  ]);

  const feedbackTrends =
    feedbackRows.length > 0 ? analyzeFeedbackTrends(feedbackRows, 1) : null;

  const event = parseEventConfig(location.denis_event_config);
  const reservations = event ? [reservationFromEvent(event, date)].filter(Boolean) as Reservation[] : [];
  const activeEvents = event ? [eventToForecastEvent(event)] : [];

  const demandForecast = forecastDemand({
    historicalOrders,
    dayOfWeek: weekday,
    weather: null,
    reservations,
    activeEvents,
    date,
    minHistoryDays: 30,
  });
  const demandForecastLines = formatPrepBriefingLines(demandForecast);
  const rhythmRushLines = buildRhythmRushHourLines({
    priors: rhythmRow?.priors ?? null,
    weekday,
    minSampleSessions: config.rhythm.minSampleSessions,
  });

  const eightySixFormatter = new Intl.DateTimeFormat("sr-RS", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const yesterdayEightySixLines = yesterdayEightySixEvents.map(
    (event) =>
      `${eightySixFormatter.format(new Date(event.at))} ${event.productName}`
  );

  const repeatingStationIssues = aggregateRepeatingStationIssues(
    (yesterdayStationQuestions.data ?? []).map((row) => ({
      station: (row as { station: "kitchen" | "bar" }).station,
    }))
  );

  const briefingInput: BuildDailyPrepBriefingInput = {
    date,
    venueName: location.name,
    weekday,
    weekdayLabel,
    rhythmStress: peakSlot
      ? rhythm.currentSlotStress
      : rhythm.currentSlotStress,
    weather: null,
    returningGuests,
    lowStock: inventorySnapshot.levels
      .filter((level) => level.status === "low" || level.status === "critical")
      .map((level) => ({
        productName: level.productName,
        remaining: level.currentStock ?? 0,
      })),
    unavailableProductNames: (unavailableRows.data ?? []).map(
      (row) => (row as { name: string }).name
    ),
    menuChanges,
    yesterdayOrders: yesterdayData.items,
    yesterdayFeedback: feedbackRows.map((row) => ({
      rating: row.rating,
      comment:
        row.sentiment === "negative" && row.category
          ? `Negativno: ${row.category}`
          : null,
      category: row.category,
    })),
    prepTimeAvgMinutes: rhythm.kitchenPrepAvgMinutes,
    waitTimeComplaintCount: feedbackTrends?.topComplaintCategory === "wait_time"
      ? feedbackTrends.topComplaintCount
      : feedbackTrends && feedbackTrends.waitTimeNegativeShare >= 0.3
        ? Math.max(1, Math.round(feedbackTrends.recentNegativeRate * 10))
        : 0,
    currencyLabel: "RSD",
    demandForecastLines: [
      ...rhythmRushLines,
      ...formatMorningPrepReplenishment(inventorySnapshot.alerts),
      ...demandForecastLines,
    ].slice(0, 6),
    yesterdayEightySixLines,
    repeatingStationIssues,
    yesterdayFiscal: yesterdayFiscal
      ? {
          ...yesterdayFiscal,
          currency:
            (orgRow.data as unknown as { currency?: string } | null)?.currency ??
            "EUR",
        }
      : null,
  };

  return buildDailyPrepBriefing(briefingInput);
}

/** X2 — Predictive demand per item per hour for kitchen prep briefing. */

export type DemandForecastEvent = {
  name: string;
  expectedGuests?: number;
  presetMenu?: boolean;
  presetProductIds?: string[];
  startTime?: string;
};

export type OrderRow = {
  productId: string;
  productName: string;
  quantity: number;
  createdAt: string;
};

export type Reservation = {
  partySize: number;
  scheduledAt: string;
};

export type DemandForecast = {
  date: string;
  slots: Array<{
    hour: number;
    predictions: Array<{
      productId: string;
      productName: string;
      expectedQuantity: number;
      confidence: number;
      factors: string[];
    }>;
  }>;
};

export type HistoricalBaseline = Map<
  string,
  {
    productName: string;
    hours: Map<number, { totalQuantity: number; sampleDays: number }>;
  }
>;

export type WeatherStub = {
  temp: number;
  condition: string;
};

const MIN_HISTORY_DAYS = 30;
const MIN_CONFIDENCE = 0.5;

function dayName(dayOfWeek: number): string {
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][dayOfWeek] ?? "mon";
}

/** Average item count per hour for the target weekday from historical orders. */
export function buildHistoricalBaseline(
  orders: OrderRow[],
  dayOfWeek: number
): HistoricalBaseline {
  const baseline: HistoricalBaseline = new Map();
  const daysByProduct = new Map<string, Set<string>>();

  for (const order of orders) {
    const created = new Date(order.createdAt);
    if (created.getUTCDay() !== dayOfWeek) continue;

    const dayKey = order.createdAt.slice(0, 10);
    const hour = created.getUTCHours();

    let product = baseline.get(order.productId);
    if (!product) {
      product = { productName: order.productName, hours: new Map() };
      baseline.set(order.productId, product);
    }

    const bucket = product.hours.get(hour) ?? { totalQuantity: 0, sampleDays: 0 };
    bucket.totalQuantity += order.quantity;
    product.hours.set(hour, bucket);

    let days = daysByProduct.get(order.productId);
    if (!days) {
      days = new Set();
      daysByProduct.set(order.productId, days);
    }
    days.add(dayKey);
  }

  for (const [productId, product] of baseline) {
    const dayCount = Math.max(1, daysByProduct.get(productId)?.size ?? 1);
    for (const [hour, bucket] of product.hours) {
      bucket.sampleDays = dayCount;
      product.hours.set(hour, bucket);
    }
  }

  return baseline;
}

/** Boost expected demand around reservation hours (party size drives multiplier). */
export function adjustForReservations(
  expectedByProductHour: Map<string, Map<number, number>>,
  reservations: Reservation[]
): Map<number, number> {
  const guestsByHour = new Map<number, number>();

  for (const reservation of reservations) {
    const hour = new Date(reservation.scheduledAt).getUTCHours();
    guestsByHour.set(
      hour,
      (guestsByHour.get(hour) ?? 0) + reservation.partySize
    );
  }

  for (const hourMap of expectedByProductHour.values()) {
    for (const [hour, quantity] of hourMap) {
      const guestCount = guestsByHour.get(hour) ?? 0;
      if (guestCount <= 0) continue;
      hourMap.set(hour, quantity * (1 + guestCount / 40));
    }
  }

  return guestsByHour;
}

/** Event + preset menu shifts demand toward featured items. */
export function adjustForEvents(
  expectedByProductHour: Map<string, Map<number, number>>,
  activeEvents: DemandForecastEvent[]
): string[] {
  const factors: string[] = [];
  if (activeEvents.length === 0) return factors;

  factors.push("event_nearby");

  for (const event of activeEvents) {
    if (event.presetMenu && (event.presetProductIds?.length ?? 0) > 0) {
      const presetIds = new Set(event.presetProductIds);
      for (const [productId, hourMap] of expectedByProductHour) {
        const multiplier = presetIds.has(productId) ? 1.6 : 0.65;
        for (const [hour, quantity] of hourMap) {
          hourMap.set(hour, quantity * multiplier);
        }
      }
      factors.push("preset_menu");
      continue;
    }

    const guestBoost = Math.max(1, (event.expectedGuests ?? 0) / 50);
    for (const hourMap of expectedByProductHour.values()) {
      for (const [hour, quantity] of hourMap) {
        hourMap.set(hour, quantity * (1.25 * guestBoost));
      }
    }
  }

  return factors;
}

function weatherModifier(productName: string, weather: WeatherStub | null): number {
  if (!weather) return 1;

  const lower = productName.toLowerCase();
  const isColdDrink =
    lower.includes("pivo") ||
    lower.includes("pilsner") ||
    lower.includes("cola") ||
    lower.includes("water") ||
    lower.includes("sok") ||
    lower.includes("limunad");
  const isSalad =
    lower.includes("salat") || lower.includes("salad") || lower.includes("salata");
  const isSoup =
    lower.includes("sup") || lower.includes("soup") || lower.includes("čorba");

  if (weather.condition === "rain") {
    return isColdDrink ? 0.85 : isSoup ? 1.15 : 1;
  }

  if (weather.temp > 30) {
    if (isColdDrink) return 1.5;
    if (isSalad) return 1.35;
    if (isSoup) return 0.35;
  }

  return 1;
}

/** Stub weather adjustment — hot days favor salads and cold drinks. */
export function adjustForWeather(
  expectedByProductHour: Map<string, Map<number, number>>,
  productNames: Map<string, string>,
  weather: WeatherStub | null
): string[] {
  const factors: string[] = [];
  if (!weather) return factors;

  if (weather.condition === "rain") factors.push("rain");
  if (weather.temp > 30) factors.push("hot");
  if (weather.condition === "sunny") factors.push("sunny");

  for (const [productId, hourMap] of expectedByProductHour) {
    const productName = productNames.get(productId) ?? productId;
    const modifier = weatherModifier(productName, weather);
    if (modifier === 1) continue;
    for (const [hour, quantity] of hourMap) {
      hourMap.set(hour, quantity * modifier);
    }
  }

  return factors;
}

function baselineToExpectedMap(
  baseline: HistoricalBaseline,
  holidayMultiplier: number
): Map<string, Map<number, number>> {
  const expected = new Map<string, Map<number, number>>();

  for (const [productId, product] of baseline) {
    const hourMap = new Map<number, number>();
    for (const [hour, bucket] of product.hours) {
      const avgPerDay = bucket.totalQuantity / bucket.sampleDays;
      hourMap.set(hour, avgPerDay * holidayMultiplier);
    }
    expected.set(productId, hourMap);
  }

  return expected;
}

function computeConfidence(
  sampleDays: number,
  hasEnoughHistory: boolean
): number {
  if (!hasEnoughHistory) return 0.3;
  return Math.min(0.95, 0.4 + sampleDays * 0.1);
}

export function forecastDemand(input: {
  historicalOrders: OrderRow[];
  dayOfWeek: number;
  isHoliday?: boolean;
  weather?: WeatherStub | null;
  activeEvents?: DemandForecastEvent[];
  reservations?: Reservation[];
  date?: string;
  minHistoryDays?: number;
}): DemandForecast {
  const uniqueDays = new Set(
    input.historicalOrders.map((order) => order.createdAt.slice(0, 10))
  );
  const hasEnoughHistory =
    uniqueDays.size >= (input.minHistoryDays ?? MIN_HISTORY_DAYS);

  const baseline = buildHistoricalBaseline(
    input.historicalOrders,
    input.dayOfWeek
  );

  const baseFactors = [dayName(input.dayOfWeek)];
  if (input.isHoliday) baseFactors.push("holiday");

  const holidayMultiplier = input.isHoliday ? 1.3 : 1;
  const expectedByProductHour = baselineToExpectedMap(
    baseline,
    holidayMultiplier
  );

  const productNames = new Map<string, string>();
  for (const [productId, product] of baseline) {
    productNames.set(productId, product.productName);
  }
  for (const order of input.historicalOrders) {
    if (!productNames.has(order.productId)) {
      productNames.set(order.productId, order.productName);
    }
  }

  const reservationFactors: string[] =
    (input.reservations?.length ?? 0) > 0 ? ["reservations"] : [];
  adjustForReservations(expectedByProductHour, input.reservations ?? []);

  const eventFactors = adjustForEvents(
    expectedByProductHour,
    input.activeEvents ?? []
  );
  const weatherFactors = adjustForWeather(
    expectedByProductHour,
    productNames,
    input.weather ?? null
  );

  const factors = [
    ...baseFactors,
    ...reservationFactors,
    ...eventFactors,
    ...weatherFactors,
  ];

  const slots: DemandForecast["slots"] = [];

  for (let hour = 10; hour <= 23; hour += 1) {
    const predictions: DemandForecast["slots"][number]["predictions"] = [];

    for (const [productId, hourMap] of expectedByProductHour) {
      const quantity = hourMap.get(hour);
      if (quantity == null || quantity <= 0) continue;

      const bucket = baseline.get(productId)?.hours.get(hour);
      const confidence = computeConfidence(
        bucket?.sampleDays ?? 0,
        hasEnoughHistory
      );
      if (confidence < MIN_CONFIDENCE) continue;

      predictions.push({
        productId,
        productName: productNames.get(productId) ?? productId,
        expectedQuantity: Math.max(1, Math.round(quantity)),
        confidence,
        factors: [...factors],
      });
    }

    predictions.sort((a, b) => b.expectedQuantity - a.expectedQuantity);
    if (predictions.length > 0) {
      slots.push({ hour, predictions: predictions.slice(0, 10) });
    }
  }

  return {
    date: input.date ?? new Date().toISOString().slice(0, 10),
    slots,
  };
}

export function aggregateDailyDemand(
  forecast: DemandForecast
): Array<{ productId: string; productName: string; total: number; peakHour: number }> {
  const totals = new Map<
    string,
    { productName: string; total: number; peakHour: number; peakQty: number }
  >();

  for (const slot of forecast.slots) {
    for (const prediction of slot.predictions) {
      const entry =
        totals.get(prediction.productId) ??
        {
          productName: prediction.productName,
          total: 0,
          peakHour: slot.hour,
          peakQty: 0,
        };
      entry.total += prediction.expectedQuantity;
      if (prediction.expectedQuantity > entry.peakQty) {
        entry.peakQty = prediction.expectedQuantity;
        entry.peakHour = slot.hour;
      }
      totals.set(prediction.productId, entry);
    }
  }

  return [...totals.entries()]
    .map(([productId, entry]) => ({
      productId,
      productName: entry.productName,
      total: entry.total,
      peakHour: entry.peakHour,
    }))
    .sort((a, b) => b.total - a.total);
}

function formatPrepTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function formatPrepBriefing(forecast: DemandForecast): string {
  const totals = aggregateDailyDemand(forecast);
  if (totals.length === 0) {
    return `Danas očekujemo: nema dovoljno istorije za prognozu (${forecast.date}).`;
  }

  const topItems = totals.slice(0, 3);
  const todayLine = topItems
    .map((item) => `${item.total}x ${item.productName}`)
    .join(", ");

  const peakSlot = forecast.slots.reduce(
    (best, slot) => {
      const slotTotal = slot.predictions.reduce(
        (sum, prediction) => sum + prediction.expectedQuantity,
        0
      );
      return slotTotal > best.total ? { hour: slot.hour, total: slotTotal } : best;
    },
    { hour: 0, total: 0 }
  );

  const peakStart = peakSlot.hour;
  const peakEnd = Math.min(23, peakStart + 1);
  const leadItem = totals[0]!;
  const prepCount = Math.max(leadItem.total, Math.ceil(leadItem.total * 1.15));
  const prepHour = Math.max(10, leadItem.peakHour - 1);
  const prepTime = formatPrepTime(prepHour, 30);

  return [
    `Danas očekujemo: ${todayLine}`,
    `Peak: ${peakStart}:00-${peakEnd}:00. Preporuka: pripremiti ${prepCount} porcija ${leadItem.productName} pre ${prepTime}`,
  ].join("\n");
}

export function formatPrepBriefingLines(forecast: DemandForecast): string[] {
  const text = formatPrepBriefing(forecast);
  return text.split("\n").filter(Boolean);
}

/** Boost/trim forecast when live station queues diverge from historical baseline. */
export function applyLiveStationLoadToForecast(
  forecast: DemandForecast,
  load: {
    stations: Array<{ station: string; queueDepth: number; rushMode: boolean }>;
  }
): DemandForecast {
  const rushStations = new Set(
    load.stations.filter((row) => row.rushMode).map((row) => row.station)
  );
  if (rushStations.size === 0) return forecast;

  const slots = forecast.slots.map((slot) => ({
    ...slot,
    predictions: slot.predictions.map((prediction) => {
      const name = prediction.productName.toLowerCase();
      const onGrill =
        rushStations.has("grill") &&
        /\b(burger|steak|pljeskav|grill|rostilj)\b/i.test(name);
      const onFryer =
        rushStations.has("fryer") &&
        /\b(pomfrit|fries|prženo|fried|wings)\b/i.test(name);
      const onSalad =
        rushStations.has("salad") &&
        /\b(salat|salad|salata|cezar)\b/i.test(name);

      let multiplier = 1;
      const factors = [...prediction.factors];

      if (onGrill || onFryer) {
        multiplier *= 0.75;
        factors.push("live_station_rush_downshift");
      }
      if (onSalad && !rushStations.has("salad")) {
        multiplier *= 1.2;
        factors.push("live_station_salad_boost");
      }

      if (multiplier === 1) return prediction;

      return {
        ...prediction,
        expectedQuantity: Math.max(
          1,
          Math.round(prediction.expectedQuantity * multiplier)
        ),
        factors,
      };
    }),
  }));

  return { ...forecast, slots };
}

/** Map demand forecast peaks → venue knowledge slot session hints. */
export function buildPeakHourKnowledgeFromForecast(
  forecast: DemandForecast
): Record<string, { sampleSessions: number; avgWaitMinutes: number | null }> {
  const result: Record<
    string,
    { sampleSessions: number; avgWaitMinutes: number | null }
  > = {};

  for (const slot of forecast.slots) {
    const slotTotal = slot.predictions.reduce(
      (sum, prediction) => sum + prediction.expectedQuantity,
      0
    );
    if (slotTotal <= 0) continue;
    const dow = new Date(`${forecast.date}T12:00:00.000Z`).getUTCDay();
    const slotKey = `${dow}:${slot.hour}`;
    result[slotKey] = {
      sampleSessions: Math.round(slotTotal),
      avgWaitMinutes: slotTotal >= 8 ? 3 : slotTotal <= 2 ? 1 : 2,
    };
  }

  return result;
}

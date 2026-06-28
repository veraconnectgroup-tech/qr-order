import { describe, expect, it } from "vitest";
import {
  forecastDemand,
  formatPrepBriefing,
} from "@/lib/denis/intelligence/demand-forecast";

const PRODUCTS = {
  schnitzel: { id: "schnitzel-id", name: "Schnitzel" },
  pilsner: { id: "pilsner-id", name: "Pilsner" },
  tiramisu: { id: "tiramisu-id", name: "Tiramisu" },
  salad: { id: "salad-id", name: "Caesar salata" },
} as const;

function buildWeekdayHistory(
  weeks: number,
  dayOfWeek: number,
  product: { id: string; name: string },
  quantityByHour: Record<number, number>
) {
  const rows = [];
  for (let week = 0; week < weeks; week += 1) {
    const date = new Date(Date.UTC(2026, 0, 4 + week * 7));
    if (date.getUTCDay() !== dayOfWeek) {
      date.setUTCDate(date.getUTCDate() + ((dayOfWeek - date.getUTCDay() + 7) % 7));
    }

    for (const [hourRaw, quantity] of Object.entries(quantityByHour)) {
      const hour = Number(hourRaw);
      rows.push({
        productId: product.id,
        productName: product.name,
        quantity,
        createdAt: new Date(
          Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
            hour,
            0,
            0
          )
        ).toISOString(),
      });
    }
  }
  return rows;
}

describe("demand forecast X2", () => {
  it("forecasts friday demand with confidence above 50% when history exists", () => {
    const forecast = forecastDemand({
      historicalOrders: buildWeekdayHistory(13, 5, PRODUCTS.schnitzel, {
        12: 4,
        13: 4,
        14: 4,
      }),
      dayOfWeek: 5,
      isHoliday: false,
      weather: { temp: 28, condition: "sunny" },
      activeEvents: [],
      reservations: [],
      date: "2026-06-27",
      minHistoryDays: 5,
    });

    const noonSlot = forecast.slots.find((slot) => slot.hour === 12);
    expect(noonSlot).toBeDefined();
    const burger = noonSlot?.predictions.find(
      (prediction) => prediction.productId === PRODUCTS.schnitzel.id
    );
    expect(burger).toBeDefined();
    expect(burger!.confidence).toBeGreaterThan(0.5);
    expect(burger!.expectedQuantity).toBeGreaterThan(0);
    expect(burger!.factors).toContain("fri");
    expect(burger!.factors).toContain("sunny");
  });

  it("uses 30 days of history and reservations with confidence above 70%", () => {
    const historicalOrders = [
      ...buildWeekdayHistory(30, 5, PRODUCTS.schnitzel, { 19: 3, 20: 4 }),
      ...buildWeekdayHistory(30, 5, PRODUCTS.pilsner, { 19: 5, 20: 6 }),
      ...buildWeekdayHistory(30, 5, PRODUCTS.tiramisu, { 19: 1, 20: 1 }),
    ];

    const forecast = forecastDemand({
      historicalOrders,
      dayOfWeek: 5,
      weather: { temp: 32, condition: "sunny" },
      reservations: [
        { partySize: 12, scheduledAt: "2026-06-27T19:00:00.000Z" },
        { partySize: 8, scheduledAt: "2026-06-27T19:30:00.000Z" },
      ],
      date: "2026-06-27",
      minHistoryDays: 30,
    });

    const evening = forecast.slots.find((slot) => slot.hour === 19);
    expect(evening).toBeDefined();

    const schnitzel = evening?.predictions.find(
      (prediction) => prediction.productId === PRODUCTS.schnitzel.id
    );
    expect(schnitzel).toBeDefined();
    expect(schnitzel!.confidence).toBeGreaterThan(0.7);
    expect(schnitzel!.factors).toContain("reservations");
    expect(schnitzel!.expectedQuantity).toBeGreaterThan(3);

    const briefing = formatPrepBriefing(forecast);
    expect(briefing).toContain("Danas očekujemo:");
    expect(briefing).toContain("Peak:");
    expect(briefing).toContain("Preporuka:");
  });

  it("boosts salads and cold drinks on hot days", () => {
    const historicalOrders = [
      ...buildWeekdayHistory(8, 3, PRODUCTS.schnitzel, { 13: 5 }),
      ...buildWeekdayHistory(8, 3, PRODUCTS.pilsner, { 13: 4 }),
      ...buildWeekdayHistory(8, 3, PRODUCTS.salad, { 13: 2 }),
    ];

    const baseline = forecastDemand({
      historicalOrders,
      dayOfWeek: 3,
      weather: { temp: 22, condition: "cloudy" },
      minHistoryDays: 4,
    });
    const hot = forecastDemand({
      historicalOrders,
      dayOfWeek: 3,
      weather: { temp: 34, condition: "sunny" },
      minHistoryDays: 4,
    });

    const baselinePilsner = baseline.slots
      .find((slot) => slot.hour === 13)
      ?.predictions.find((row) => row.productId === PRODUCTS.pilsner.id)
      ?.expectedQuantity;
    const hotPilsner = hot.slots
      .find((slot) => slot.hour === 13)
      ?.predictions.find((row) => row.productId === PRODUCTS.pilsner.id)
      ?.expectedQuantity;
    const hotSalad = hot.slots
      .find((slot) => slot.hour === 13)
      ?.predictions.find((row) => row.productId === PRODUCTS.salad.id)
      ?.expectedQuantity;

    expect(hotPilsner).toBeGreaterThan(baselinePilsner ?? 0);
    expect(hotSalad).toBeGreaterThan(2);
    expect(hot.slots[0]?.predictions[0]?.factors).toContain("hot");
  });
});

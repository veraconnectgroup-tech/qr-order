import { describe, expect, it } from "vitest";
import {
  buildDailyPrepBriefing,
  formatDailyPrepBriefingText,
  formatDailyPrepCopilotLines,
} from "@/lib/admin/build-daily-prep-briefing";

describe("buildDailyPrepBriefing", () => {
  it("builds Friday briefing with returning guests, stock, weather, and focus", () => {
    const briefing = buildDailyPrepBriefing({
      date: "2026-06-27",
      venueName: "Kafana Beograd",
      weekday: 5,
      weekdayLabel: "Petak",
      rhythmStress: "busy",
      weather: {
        temp: 35,
        condition: "sunny",
        suggestion: "Ponudi hladna pića i terasu.",
      },
      returningGuests: [
        {
          guestLabel: "Marko V.",
          visitCount: 7,
          isVip: true,
          lastVisitItemNames: ["Ćevapi"],
          modifierPreferences: ["bez luka"],
        },
        {
          guestLabel: "Ana K.",
          visitCount: 3,
          isVip: false,
          lastVisitItemNames: ["Salata"],
          modifierPreferences: [],
        },
        {
          guestLabel: "Petar M.",
          visitCount: 6,
          isVip: true,
          lastVisitItemNames: ["Burger"],
          modifierPreferences: [],
        },
      ],
      lowStock: [{ productName: "Tiramisu", remaining: 4 }],
      unavailableProductNames: [],
      menuChanges: ["Novo: Sezonska limunada"],
      yesterdayOrders: [
        {
          productId: "p1",
          productName: "Burger",
          quantity: 34,
          total: 34000,
        },
        {
          productId: "p2",
          productName: "Pivo",
          quantity: 20,
          total: 11200,
        },
      ],
      yesterdayFeedback: [
        { rating: 4, comment: null },
        { rating: 5, comment: null },
        { rating: 2, comment: "Čekali predugo", category: "wait_time" },
        { rating: 2, comment: "Sporo", category: "wait_time" },
        { rating: 2, comment: "Još čekanje", category: "wait_time" },
      ],
      prepTimeAvgMinutes: 18,
      waitTimeComplaintCount: 3,
      currencyLabel: "RSD",
    });

    expect(briefing.sections.predictedBusyness).toBe("busy");
    expect(briefing.sections.returningGuests.count).toBe(3);
    expect(briefing.sections.returningGuests.vipNames.length).toBeGreaterThan(0);
    expect(briefing.sections.lowStockAlerts).toContain(
      "Tiramisu — ostalo 4 porcije"
    );
    expect(briefing.sections.weather?.temp).toBe(35);
    expect(briefing.sections.todayFocus.some((line) => line.includes("35"))).toBe(
      true
    );
    expect(briefing.sections.yesterdayHighlights.topItem).toBe("Burger");

    const text = formatDailyPrepBriefingText(briefing, {
      weekdayLabel: "Petak",
      currencyLabel: "RSD",
    });

    expect(text).toContain("Kafana Beograd");
    expect(text).toContain("Petak");
    expect(text).toContain("Tiramisu");
    expect(text).toContain("Marko V.");
    expect(text).toContain("FOKUS");
    expect(text).toContain("45.200");
  });

  it("includes yesterday fiscal summary in briefing and copilot lines", () => {
    const briefing = buildDailyPrepBriefing({
      date: "2026-06-28",
      venueName: "Café Mitte",
      weekday: 1,
      weekdayLabel: "Ponedeljak",
      returningGuests: [],
      lowStock: [],
      unavailableProductNames: [],
      menuChanges: [],
      yesterdayOrders: [],
      yesterdayFeedback: [],
      yesterdayFiscal: {
        orderCount: 47,
        totalGross: 2340,
        refundCount: 2,
        currency: "EUR",
      },
    });

    expect(briefing.sections.yesterdayHighlights.fiscalSummaryLine).toContain(
      "47 narudžbina"
    );
    expect(briefing.sections.yesterdayHighlights.fiscalSummaryLine).toContain(
      "2 storna"
    );

    const text = formatDailyPrepBriefingText(briefing);
    expect(text).toContain("FISKAL:");
    expect(formatDailyPrepCopilotLines(briefing).some((line) => line.includes("Juče"))).toBe(
      true
    );
  });
});

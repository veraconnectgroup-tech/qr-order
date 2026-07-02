import { describe, expect, it } from "vitest";
import {
  buildDailyPrepBriefing,
  formatDailyPrepBriefingText,
} from "@/lib/admin/build-daily-prep-briefing";
import { buildRhythmRushHourLines } from "@/lib/admin/prep-briefing-rhythm-rush";
import {
  aggregateRepeatingStationIssues,
  REPEATING_STATION_ISSUE_THRESHOLD,
} from "@/lib/admin/prep-briefing-station-issues";

describe("S14 prep briefing extensions", () => {
  it("includes rhythm rush, yesterday 86, and repeating station issues", () => {
    const briefing = buildDailyPrepBriefing({
      date: "2026-07-02",
      venueName: "Kafana Beograd",
      weekday: 4,
      weekdayLabel: "Četvrtak",
      rhythmStress: "busy",
      returningGuests: [],
      lowStock: [],
      unavailableProductNames: [],
      menuChanges: [],
      yesterdayOrders: [],
      yesterdayFeedback: [],
      demandForecastLines: ["Peak: 19:00-21:00. Preporuka: pripremiti 40 porcija ćevapa"],
      yesterdayEightySixLines: ["20:30 Ćevapi", "21:15 Pljeskavica"],
      repeatingStationIssues: [
        "Kuhinja juče 3× pitanja od Denis-a — večeras treba pomoć oko odgovora.",
      ],
    });

    expect(briefing.sections.yesterdayEightySix).toEqual([
      "20:30 Ćevapi",
      "21:15 Pljeskavica",
    ]);
    expect(briefing.sections.repeatingStationIssues[0]).toContain("Kuhinja");
    expect(briefing.sections.demandForecast[0]).toContain("Peak");

    const text = formatDailyPrepBriefingText(briefing);
    expect(text).toContain("JUČE 86");
    expect(text).toContain("PONAVLJAJUĆI PROBLEMI");
    expect(text).toContain("PROGNOZA POTRAŽNJE");
  });

  it(`flags repeating issues at threshold ${REPEATING_STATION_ISSUE_THRESHOLD}`, () => {
    const below = aggregateRepeatingStationIssues([
      { station: "kitchen" },
      { station: "kitchen" },
    ]);
    expect(below).toEqual([]);

    const at = aggregateRepeatingStationIssues([
      { station: "kitchen" },
      { station: "kitchen" },
      { station: "kitchen" },
    ]);
    expect(at).toHaveLength(1);
    expect(at[0]).toContain("Kuhinja");
  });

  it("builds rhythm rush hour lines from priors", () => {
    const lines = buildRhythmRushHourLines({
      priors: {
        version: 1,
        slots: {
          "4:19": {
            sampleSessions: 40,
            sessionDurationP50Min: 60,
            dessertDelayP50Min: null,
            revenueEma: null,
            topProducts: [],
            servicePeriod: "dinner",
          },
          "4:20": {
            sampleSessions: 45,
            sessionDurationP50Min: 60,
            dessertDelayP50Min: null,
            revenueEma: null,
            topProducts: [],
            servicePeriod: "dinner",
          },
        },
      },
      weekday: 4,
      minSampleSessions: 8,
    });

    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).toContain("Gužva po satu");
  });
});

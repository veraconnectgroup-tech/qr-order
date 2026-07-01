import { describe, expect, it, vi } from "vitest";
import { beliefGraph } from "@/lib/denis/cognition/tde";
import { buildSituationPack } from "@/lib/denis/cognition/context/build-situation-pack";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import {
  buildContextAwarenessSnapshot,
  buildSeasonalContext,
  buildTimeOfDayContext,
  resolveTimeOfDayBand,
} from "@/lib/denis/intelligence/event-context";
import {
  buildWeatherContextFromReading,
  buildWeatherSuggestion,
  classifyWeatherCondition,
  loadCachedWeatherContext,
  WEATHER_CACHE_TTL_SECONDS,
  weatherCacheKey,
} from "@/lib/denis/intelligence/weather-context";
import { buildExternalContextSituationBlock } from "@/lib/denis/intelligence/resolve-context-awareness";

describe("weather context", () => {
  it("classifies temp below 5°C as cold", () => {
    expect(classifyWeatherCondition(3, "Clear")).toBe("cold");
  });

  it("suggests soup on cold days", () => {
    const copy = buildWeatherSuggestion("cold", 3, "sr");
    expect(copy.suggestion).toMatch(/supa|topla/i);
    expect(copy.menuBias).toContain("soups");
  });

  it("suggests refreshing drinks on hot days", () => {
    const weather = buildWeatherContextFromReading({
      tempC: 34,
      openWeatherMain: "Clear",
      language: "sr",
    });
    expect(weather.condition).toBe("hot");
    expect(weather.suggestion).toMatch(/34|limonada|Spritz/i);
  });

  it("uses 1 hour cache key per location", () => {
    expect(weatherCacheKey("loc-1")).toBe("denis:weather:loc-1");
    expect(WEATHER_CACHE_TTL_SECONDS).toBe(3600);
  });

  it("loads weather from API once and reuses fetch contract", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        main: { temp: 2.4 },
        weather: [{ main: "Clouds", description: "overcast" }],
      }),
    });

    const intelligence = {
      ...CONCIERGE_PLATFORM_DEFAULTS.intelligence,
      weather: {
        enabled: true,
        openWeatherMapApiKey: "test-key",
        latitude: 44.8,
        longitude: 20.5,
      },
    };

    const result = await loadCachedWeatherContext({
      locationId: "loc-test",
      intelligence,
      language: "sr",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result?.tempC).toBeCloseTo(2.4);
    expect(result?.condition).toBe("cold");
    expect(fetchImpl.mock.calls[0]?.[0]).toContain("openweathermap.org");
  });
});

describe("event and time context", () => {
  it("highlights salads in summer", () => {
    const seasonal = buildSeasonalContext("summer", "sr");
    expect(seasonal.highlightCategories).toEqual([
      "salads",
      "cold drinks",
      "ice cream",
    ]);
    expect(seasonal.suggestion).toMatch(/salate|hladna/i);
  });

  it("maps 22:00 to late-night bar mode", () => {
    expect(resolveTimeOfDayBand(22)).toBe("late_night");
    const time = buildTimeOfDayContext({ localHour: 22, language: "sr" });
    expect(time.mode).toBe("bar");
    expect(time.suggestion).toMatch(/Bar|pijemo/i);
  });

  it("builds morning and lunch hooks", () => {
    const morning = buildTimeOfDayContext({ localHour: 9, language: "sr" });
    expect(morning.mode).toBe("breakfast");
    expect(morning.suggestion).toMatch(/jutro|Kafa/i);

    const lunch = buildTimeOfDayContext({
      localHour: 12,
      language: "sr",
      dailyMenuLabel: "Ćevapi + salata",
    });
    expect(lunch.mode).toBe("lunch");
    expect(lunch.suggestion).toMatch(/dnevni meni|Ćevapi/i);
  });

  it("adds sports match hook in the evening", () => {
    const snapshot = buildContextAwarenessSnapshot({
      intelligence: {
        ...CONCIERGE_PLATFORM_DEFAULTS.intelligence,
        localSportsTeam: "Partizan",
      },
      language: "sr",
      nowMs: Date.parse("2026-06-28T20:00:00+02:00"),
      sportsMatchTonight: true,
    });

    expect(snapshot.event?.kind).toBe("sports_match");
    expect(snapshot.event?.suggestion).toMatch(/Partizan|ekipu/i);
  });
});

describe("situation pack external context", () => {
  it("includes WEATHER and TIME blocks in situation pack", () => {
    const snapshot = buildContextAwarenessSnapshot({
      intelligence: CONCIERGE_PLATFORM_DEFAULTS.intelligence,
      language: "sr",
      weather: buildWeatherContextFromReading({
        tempC: 3,
        openWeatherMain: "Clear",
        language: "sr",
      }),
    });

    snapshot.timeOfDay = buildTimeOfDayContext({ localHour: 22, language: "sr" });
    snapshot.seasonal = buildSeasonalContext("summer", "sr");

    const block = buildExternalContextSituationBlock(snapshot);
    expect(block).toContain("WEATHER:");
    expect(block).toContain("condition: cold");
    expect(block).toContain("TIME:");
    expect(block).toContain("mode: bar");
    expect(block).toContain("SEASON:");
    expect(block).toContain("summer");

    const pack = buildSituationPack({
      beliefs: beliefGraph([]),
      contextAwareness: snapshot,
    });

    expect(pack).toContain("WEATHER:");
    expect(pack).toContain("supa");
    expect(pack).toContain("mode: bar");
    expect(pack).toContain("salads");
  });
});

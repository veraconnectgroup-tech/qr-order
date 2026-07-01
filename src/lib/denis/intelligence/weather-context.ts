import { getRedisClient, logRedisDegradation } from "@/lib/redis/client";
import type { ConciergeIntelligence } from "@/lib/denis/config/concierge-config.schema";

export type WeatherConditionKind = "cold" | "hot" | "rain" | "mild";

export type WeatherContext = {
  tempC: number;
  condition: WeatherConditionKind;
  description: string;
  suggestion: string;
  menuBias: string[];
  fetchedAt: string;
  source: "openweathermap" | "stub";
};

export const WEATHER_CACHE_TTL_SECONDS = 3600;

export function weatherCacheKey(locationId: string): string {
  return `denis:weather:${locationId}`;
}

export function classifyWeatherCondition(
  tempC: number,
  openWeatherMain: string
): WeatherConditionKind {
  const main = openWeatherMain.trim().toLowerCase();
  if (/rain|drizzle|thunderstorm|snow/.test(main)) {
    return tempC < 8 ? "cold" : "rain";
  }
  if (tempC < 5) return "cold";
  if (tempC >= 30) return "hot";
  return "mild";
}

export function buildWeatherSuggestion(
  condition: WeatherConditionKind,
  tempC: number,
  language: string
): { suggestion: string; menuBias: string[] } {
  const lang = language.toLowerCase().slice(0, 2);

  if (condition === "cold") {
    return lang === "de"
      ? {
          suggestion: `Kalt draußen (${Math.round(tempC)}°C)! Unsere warme Suppe passt perfekt heute.`,
          menuBias: ["soups", "hot dishes", "tea"],
        }
      : lang === "en"
        ? {
            suggestion: `Chilly outside (${Math.round(tempC)}°C)! Our hot soup is perfect today.`,
            menuBias: ["soups", "hot dishes", "tea"],
          }
        : {
            suggestion: `Hladno napolju (${Math.round(tempC)}°C)! Naša topla supa je savršena danas.`,
            menuBias: ["soups", "hot dishes", "tea"],
          };
  }

  if (condition === "hot") {
    return lang === "de"
      ? {
          suggestion: `${Math.round(tempC)}°C! Erfrischender Hugo Spritz oder Limonade?`,
          menuBias: ["salads", "cold drinks", "ice cream"],
        }
      : lang === "en"
        ? {
            suggestion: `${Math.round(tempC)}°C! Refreshing Hugo Spritz or lemonade?`,
            menuBias: ["salads", "cold drinks", "ice cream"],
          }
        : {
            suggestion: `${Math.round(tempC)}°C! Osvježavajući Hugo Spritz ili limonada?`,
            menuBias: ["salads", "cold drinks", "ice cream"],
          };
  }

  if (condition === "rain") {
    return lang === "de"
      ? {
          suggestion:
            "Regen draußen — drinnen ist es gemütlich! Schokoladenkuchen?",
          menuBias: ["desserts", "hot drinks", "comfort food"],
        }
      : lang === "en"
        ? {
            suggestion:
              "Rain outside — cozy inside! Chocolate cake?",
            menuBias: ["desserts", "hot drinks", "comfort food"],
          }
        : {
            suggestion:
              "Kiša napolju, ali unutra je toplo! Čokoladan kolač?",
            menuBias: ["desserts", "hot drinks", "comfort food"],
          };
  }

  return lang === "de"
    ? {
        suggestion: `Angenehm ${Math.round(tempC)}°C — ich helfe bei der Auswahl.`,
        menuBias: ["seasonal specials"],
      }
    : lang === "en"
      ? {
          suggestion: `Pleasant ${Math.round(tempC)}°C — happy to help you choose.`,
          menuBias: ["seasonal specials"],
        }
      : {
          suggestion: `Prijatnih ${Math.round(tempC)}°C — tu sam za preporuku.`,
          menuBias: ["seasonal specials"],
        };
}

export function buildWeatherContextFromReading(input: {
  tempC: number;
  openWeatherMain: string;
  description?: string;
  language: string;
  source?: WeatherContext["source"];
  fetchedAt?: string;
}): WeatherContext {
  const condition = classifyWeatherCondition(input.tempC, input.openWeatherMain);
  const copy = buildWeatherSuggestion(condition, input.tempC, input.language);

  return {
    tempC: input.tempC,
    condition,
    description: input.description?.trim() || input.openWeatherMain,
    suggestion: copy.suggestion,
    menuBias: copy.menuBias,
    fetchedAt: input.fetchedAt ?? new Date().toISOString(),
    source: input.source ?? "stub",
  };
}

export function buildWeatherSituationBlock(weather: WeatherContext | null): string {
  if (!weather) return "";

  return [
    "WEATHER:",
    `- temp_c: ${Math.round(weather.tempC)}`,
    `- condition: ${weather.condition}`,
    `- description: ${weather.description}`,
    `- guest_hook: ${weather.suggestion}`,
    `- menu_bias: ${weather.menuBias.join(", ")}`,
    "- use weather hook once when greeting or recommending — do not repeat every turn",
  ].join("\n");
}

type OpenWeatherResponse = {
  main?: { temp?: number };
  weather?: Array<{ main?: string; description?: string }>;
};

export function parseOpenWeatherResponse(
  payload: OpenWeatherResponse,
  language: string
): WeatherContext | null {
  const tempC = payload.main?.temp;
  const row = payload.weather?.[0];
  if (tempC == null || !row?.main) return null;

  return buildWeatherContextFromReading({
    tempC,
    openWeatherMain: row.main,
    description: row.description,
    language,
    source: "openweathermap",
  });
}

export function resolveOpenWeatherApiKey(
  intelligence: ConciergeIntelligence
): string | null {
  const fromConfig = intelligence.weather.openWeatherMapApiKey?.trim();
  if (fromConfig) return fromConfig;
  const fromEnv = process.env.OPENWEATHERMAP_API_KEY?.trim();
  return fromEnv || null;
}

export async function loadCachedWeatherContext(input: {
  locationId: string;
  intelligence: ConciergeIntelligence;
  language: string;
  fetchImpl?: typeof fetch;
}): Promise<WeatherContext | null> {
  if (!input.intelligence.contextAwareness || !input.intelligence.weather.enabled) {
    return null;
  }

  const lat = input.intelligence.weather.latitude;
  const lon = input.intelligence.weather.longitude;
  if (lat == null || lon == null) return null;

  const redis = getRedisClient();
  const cacheKey = weatherCacheKey(input.locationId);

  if (redis) {
    try {
      const cached = await redis.get<WeatherContext>(cacheKey);
      if (cached?.tempC != null && cached.condition) {
        return cached;
      }
    } catch (error) {
      logRedisDegradation("weather-context.cache_read", error);
    }
  }

  const apiKey = resolveOpenWeatherApiKey(input.intelligence);
  if (!apiKey) return null;

  const fetchFn = input.fetchImpl ?? fetch;
  const url = new URL("https://api.openweathermap.org/data/2.5/weather");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("appid", apiKey);
  url.searchParams.set("units", "metric");

  try {
    const response = await fetchFn(url.toString(), {
      next: { revalidate: WEATHER_CACHE_TTL_SECONDS },
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as OpenWeatherResponse;
    const context = parseOpenWeatherResponse(payload, input.language);
    if (!context) return null;

    if (redis) {
      try {
        await redis.set(cacheKey, context, { ex: WEATHER_CACHE_TTL_SECONDS });
      } catch (error) {
        logRedisDegradation("weather-context.cache_write", error);
      }
    }

    return context;
  } catch {
    return null;
  }
}

import type { ConciergeIntelligence } from "@/lib/denis/config/concierge-config.schema";
import {
  parseEventConfig,
  resolveEventPhase,
  type EventConfig,
} from "@/lib/denis/venue/ops/event-mode";

export type TimeOfDayBand =
  | "morning"
  | "lunch"
  | "afternoon"
  | "evening"
  | "late_night";

export type SeasonKind = "winter" | "spring" | "summer" | "autumn";

export type TimeOfDayContext = {
  band: TimeOfDayBand;
  localHour: number;
  suggestion: string;
  mode: "breakfast" | "lunch" | "aperitif" | "bar" | "general";
  dailyMenuLabel: string | null;
};

export type SeasonalContext = {
  season: SeasonKind;
  highlightCategories: string[];
  suggestion: string;
};

export type EventAwarenessContext = {
  kind: "venue_event" | "holiday" | "sports_match";
  title: string;
  suggestion: string;
  phase?: string;
};

export type ContextAwarenessSnapshot = {
  weather: import("@/lib/denis/intelligence/weather-context").WeatherContext | null;
  timeOfDay: TimeOfDayContext;
  seasonal: SeasonalContext;
  event: EventAwarenessContext | null;
};

function localParts(nowMs: number, timeZone: string): { hour: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    month: "numeric",
    day: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date(nowMs));
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return {
    hour: read("hour"),
    month: read("month"),
    day: read("day"),
  };
}

export function resolveTimeOfDayBand(localHour: number): TimeOfDayBand {
  if (localHour >= 22 || localHour < 7) return "late_night";
  if (localHour >= 7 && localHour < 11) return "morning";
  if (localHour >= 11 && localHour < 15) return "lunch";
  if (localHour >= 18 && localHour < 22) return "evening";
  return "afternoon";
}

export function resolveSeasonFromMonth(month: number): SeasonKind {
  if (month === 12 || month <= 2) return "winter";
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  return "autumn";
}

export function buildSeasonalContext(
  season: SeasonKind,
  language: string
): SeasonalContext {
  const lang = language.toLowerCase().slice(0, 2);

  if (season === "summer") {
    return {
      season,
      highlightCategories: ["salads", "cold drinks", "ice cream"],
      suggestion:
        lang === "de"
          ? "Sommer — Salate, kalte Getränke und Eis hervorheben."
          : lang === "en"
            ? "Summer — highlight salads, cold drinks, and ice cream."
            : "Leto — istakni salate, hladna pića i sladoled.",
    };
  }

  if (season === "winter") {
    return {
      season,
      highlightCategories: ["soups", "hot dishes", "tea"],
      suggestion:
        lang === "de"
          ? "Winter — Suppen, warme Gerichte und Tee betonen."
          : lang === "en"
            ? "Winter — emphasize soups, hot dishes, and tea."
            : "Zima — istakni supe, topla jela i čaj.",
    };
  }

  return {
    season,
    highlightCategories: ["seasonal specials"],
    suggestion:
      lang === "de"
        ? "Saisonale Spezialitäten anbieten."
        : lang === "en"
          ? "Offer seasonal specials."
          : "Ponudi sezonske specijalitete.",
  };
}

export function buildTimeOfDayContext(input: {
  localHour: number;
  language: string;
  dailyMenuLabel?: string | null;
}): TimeOfDayContext {
  const band = resolveTimeOfDayBand(input.localHour);
  const lang = input.language.toLowerCase().slice(0, 2);
  const dailyMenuLabel = input.dailyMenuLabel?.trim() || null;

  if (band === "morning") {
    return {
      band,
      localHour: input.localHour,
      mode: "breakfast",
      dailyMenuLabel,
      suggestion:
        lang === "de"
          ? "Guten Morgen! Kaffee und Gebäck zum Start?"
          : lang === "en"
            ? "Good morning! Coffee and bakery to start?"
            : "Dobro jutro! Kafa i pekarski za početak?",
    };
  }

  if (band === "lunch") {
    const menuBit = dailyMenuLabel
      ? lang === "de"
        ? ` Unser Tagesmenü heute: ${dailyMenuLabel}.`
        : lang === "en"
          ? ` Today's daily menu: ${dailyMenuLabel}.`
          : ` Naš dnevni meni je danas ${dailyMenuLabel}!`
      : lang === "de"
        ? " Mittagszeit — Tagesgerichte empfehlen."
        : lang === "en"
          ? " Lunch time — suggest daily specials."
          : " Ručak — preporuči dnevni meni.";

    return {
      band,
      localHour: input.localHour,
      mode: "lunch",
      dailyMenuLabel,
      suggestion:
        (lang === "de"
          ? "Guten Appetit!"
          : lang === "en"
            ? "Lunch time!"
            : "Dobar dan!") + menuBit,
    };
  }

  if (band === "evening") {
    return {
      band,
      localHour: input.localHour,
      mode: "aperitif",
      dailyMenuLabel,
      suggestion:
        lang === "de"
          ? "Guten Abend! Aperitif zum Start?"
          : lang === "en"
            ? "Good evening! An aperitif to start?"
            : "Dobroveče! Aperitiv za početak?",
    };
  }

  if (band === "late_night") {
    return {
      band,
      localHour: input.localHour,
      mode: "bar",
      dailyMenuLabel,
      suggestion:
        lang === "de"
          ? "Noch da! Die Bar ist offen — was trinken wir?"
          : lang === "en"
            ? "Still here! Bar is open — what are we drinking?"
            : "Još uvek tu! Bar je otvoren — šta pijemo?",
    };
  }

  return {
    band,
    localHour: input.localHour,
    mode: "general",
    dailyMenuLabel,
    suggestion:
      lang === "de"
        ? "Schön, dass Sie da sind — womit darf ich anfangen?"
        : lang === "en"
          ? "Great to have you — what can I get started?"
          : "Drago mi je — od čega krećemo?",
  };
}

function buildHolidayContext(
  month: number,
  day: number,
  language: string
): EventAwarenessContext | null {
  const lang = language.toLowerCase().slice(0, 2);

  if (month === 12 && day >= 24 && day <= 26) {
    return {
      kind: "holiday",
      title: lang === "de" ? "Weihnachten" : lang === "en" ? "Christmas" : "Božić",
      suggestion:
        lang === "de"
          ? "Frohe Weihnachten! Unser festliches Menü ist bereit."
          : lang === "en"
            ? "Merry Christmas! Our holiday menu is ready."
            : "Sretan Božić! Naš specijalni praznični meni je spreman.",
    };
  }

  if (month === 12 && day === 31) {
    return {
      kind: "holiday",
      title: lang === "de" ? "Silvester" : lang === "en" ? "New Year's Eve" : "Doček Nove godine",
      suggestion:
        lang === "de"
          ? "Silvester — Champagner und Sharing-Platten anbieten."
          : lang === "en"
            ? "New Year's Eve — offer sparkling wine and sharing plates."
            : "Doček — ponudi šampanjac i plate za deljenje.",
    };
  }

  return null;
}

function buildVenueEventContext(
  event: EventConfig,
  language: string,
  nowMs: number
): EventAwarenessContext | null {
  const phase = resolveEventPhase(event, nowMs);
  if (phase === "winding_down") return null;

  const lang = language.toLowerCase().slice(0, 2);
  const title = event.name.trim();
  if (!title) return null;

  return {
    kind: "venue_event",
    title,
    phase,
    suggestion:
      lang === "de"
        ? `${title} — Gruppenbestellung oder Preset-Menü anbieten.`
        : lang === "en"
          ? `${title} — offer group ordering or the preset menu.`
          : `${title} — ponudi grupnu narudžbinu ili preset meni.`,
  };
}

function buildSportsMatchContext(
  teamName: string | null | undefined,
  language: string,
  localHour: number
): EventAwarenessContext | null {
  const team = teamName?.trim();
  if (!team) return null;
  if (localHour < 17 || localHour > 23) return null;

  const lang = language.toLowerCase().slice(0, 2);
  return {
    kind: "sports_match",
    title: team,
    suggestion:
      lang === "de"
        ? `Heute Abend spielt ${team}! Bestellung fürs ganze Team?`
        : lang === "en"
          ? `${team} plays tonight! Order for the whole crew?`
          : `Večeras igra ${team}! Narudžbina za celu ekipu?`,
  };
}

export function resolveEventAwarenessContext(input: {
  intelligence: ConciergeIntelligence;
  language: string;
  nowMs?: number;
  venueEventConfig?: unknown;
  sportsMatchTonight?: boolean;
}): EventAwarenessContext | null {
  const nowMs = input.nowMs ?? Date.now();
  const { hour, month, day } = localParts(nowMs, input.intelligence.timezone);

  const holiday = buildHolidayContext(month, day, input.language);
  if (holiday) return holiday;

  const parsedEvent = parseEventConfig(input.venueEventConfig);
  if (parsedEvent) {
    const venueEvent = buildVenueEventContext(parsedEvent, input.language, nowMs);
    if (venueEvent) return venueEvent;
  }

  const sportsEnabled =
    input.sportsMatchTonight !== false &&
    Boolean(input.intelligence.localSportsTeam?.trim());
  if (sportsEnabled) {
    return buildSportsMatchContext(
      input.intelligence.localSportsTeam,
      input.language,
      hour
    );
  }

  return null;
}

export function buildContextAwarenessSnapshot(input: {
  intelligence: ConciergeIntelligence;
  language: string;
  nowMs?: number;
  weather?: ContextAwarenessSnapshot["weather"];
  venueEventConfig?: unknown;
  sportsMatchTonight?: boolean;
}): ContextAwarenessSnapshot {
  const nowMs = input.nowMs ?? Date.now();
  const { hour, month } = localParts(nowMs, input.intelligence.timezone);
  const season = resolveSeasonFromMonth(month);

  return {
    weather: input.weather ?? null,
    timeOfDay: buildTimeOfDayContext({
      localHour: hour,
      language: input.language,
      dailyMenuLabel: input.intelligence.dailyMenuLabel,
    }),
    seasonal: buildSeasonalContext(season, input.language),
    event: input.intelligence.contextAwareness
      ? resolveEventAwarenessContext({
          intelligence: input.intelligence,
          language: input.language,
          nowMs,
          venueEventConfig: input.venueEventConfig,
          sportsMatchTonight: input.sportsMatchTonight,
        })
      : null,
  };
}

export function buildTimeSituationBlock(time: TimeOfDayContext | null): string {
  if (!time) return "";

  return [
    "TIME:",
    `- band: ${time.band}`,
    `- local_hour: ${time.localHour}`,
    `- mode: ${time.mode}`,
    `- guest_hook: ${time.suggestion}`,
    time.dailyMenuLabel ? `- daily_menu: ${time.dailyMenuLabel}` : null,
    "- align recommendations with time band — do not offer breakfast at bar mode",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildSeasonalSituationBlock(seasonal: SeasonalContext | null): string {
  if (!seasonal) return "";

  return [
    "SEASON:",
    `- season: ${seasonal.season}`,
    `- highlight: ${seasonal.highlightCategories.join(", ")}`,
    `- guidance: ${seasonal.suggestion}`,
  ].join("\n");
}

export function buildEventSituationBlock(event: EventAwarenessContext | null): string {
  if (!event) return "";

  return [
    "EVENT:",
    `- kind: ${event.kind}`,
    `- title: ${event.title}`,
    event.phase ? `- phase: ${event.phase}` : null,
    `- guest_hook: ${event.suggestion}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildContextAwarenessSituationBlock(
  snapshot: ContextAwarenessSnapshot | null | undefined
): string {
  if (!snapshot) return "";

  const blocks = [
    buildTimeSituationBlock(snapshot.timeOfDay),
    buildSeasonalSituationBlock(snapshot.seasonal),
    buildEventSituationBlock(snapshot.event),
  ].filter(Boolean);

  return blocks.join("\n\n");
}

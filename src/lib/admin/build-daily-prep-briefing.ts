import type { RhythmSlotStress } from "@/lib/denis/config/rhythm-prior-types";
import { formatYesterdayFiscalSummaryLine } from "@/lib/fiscal/yesterday-fiscal-summary";

export type PredictedBusyness = "quiet" | "normal" | "busy" | "rush";

export type DailyPrepBriefingWeather = {
  temp: number;
  condition: string;
  suggestion: string;
};

export type DailyPrepBriefing = {
  date: string;
  venueName: string;
  sections: {
    weather: DailyPrepBriefingWeather | null;
    predictedBusyness: PredictedBusyness;
    returningGuests: { count: number; vipNames: string[] };
    lowStockAlerts: string[];
    menuChanges: string[];
    yesterdayHighlights: {
      revenue: number;
      topItem: string;
      avgRating: number | null;
      complaints: string[];
      fiscalSummaryLine?: string | null;
    };
    todayFocus: string[];
    /** Hourly demand forecast lines (X2 + O2). */
    demandForecast: string[];
  };
};

export type DailyPrepGuestMemoryRow = {
  guestLabel: string;
  visitCount: number;
  isVip: boolean;
  lastVisitItemNames: string[];
  modifierPreferences: string[];
};

export type DailyPrepOrderRow = {
  productId: string;
  productName: string;
  quantity: number;
  total: number;
};

export type DailyPrepFeedbackRow = {
  rating: number;
  comment: string | null;
  category?: string | null;
};

export type DailyPrepStockRow = {
  productName: string;
  remaining: number;
};

export type BuildDailyPrepBriefingInput = {
  date: string;
  venueName: string;
  weekday: number;
  weekdayLabel: string;
  rhythmStress?: RhythmSlotStress | null;
  weather?: DailyPrepBriefingWeather | null;
  returningGuests: DailyPrepGuestMemoryRow[];
  lowStock: DailyPrepStockRow[];
  unavailableProductNames: string[];
  menuChanges: string[];
  yesterdayOrders: DailyPrepOrderRow[];
  yesterdayFeedback: DailyPrepFeedbackRow[];
  prepTimeAvgMinutes?: number | null;
  waitTimeComplaintCount?: number;
  currencyLabel?: string;
  demandForecastLines?: string[];
  yesterdayFiscal?: {
    orderCount: number;
    totalGross: number;
    refundCount: number;
    currency?: string;
  } | null;
};

const DAY_NAMES_SR = [
  "nedelja",
  "ponedeljak",
  "utorak",
  "sreda",
  "četvrtak",
  "petak",
  "subota",
];

function formatMoney(amount: number, currencyLabel: string): string {
  return `${Math.round(amount).toLocaleString("sr-RS")} ${currencyLabel}`;
}

function guestSummary(row: DailyPrepGuestMemoryRow): string {
  const favorite = row.lastVisitItemNames[0]?.trim();
  const mods = row.modifierPreferences.slice(0, 2).join(", ");
  const base = row.isVip ? `${row.guestLabel} — VIP` : row.guestLabel;
  if (favorite && mods) {
    return `${base}, voli ${favorite} (${mods})`;
  }
  if (favorite) {
    return `${base}, voli ${favorite}`;
  }
  return `${base} (${row.visitCount} poseta)`;
}

export function derivePredictedBusyness(input: {
  rhythmStress?: RhythmSlotStress | null;
  weekday: number;
}): PredictedBusyness {
  if (input.rhythmStress === "rush") return "rush";
  if (input.rhythmStress === "busy") return "busy";
  if (input.weekday === 0 || input.weekday === 1) return "quiet";
  if (input.weekday === 5 || input.weekday === 6) return "busy";
  return input.rhythmStress === "normal" ? "normal" : "normal";
}

function busynessLabel(level: PredictedBusyness): string {
  switch (level) {
    case "quiet":
      return "Mirniji dan";
    case "busy":
      return "Busy dan";
    case "rush":
      return "Rush dan";
    default:
      return "Normalan dan";
  }
}

function buildYesterdayHighlights(input: BuildDailyPrepBriefingInput) {
  const revenue = input.yesterdayOrders.reduce(
    (sum, row) => sum + row.total,
    0
  );

  const itemCounts = new Map<string, number>();
  for (const row of input.yesterdayOrders) {
    itemCounts.set(
      row.productName,
      (itemCounts.get(row.productName) ?? 0) + row.quantity
    );
  }

  const topItem =
    [...itemCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  const ratings = input.yesterdayFeedback.map((row) => row.rating);
  const avgRating =
    ratings.length > 0
      ? Math.round(
          (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) *
            10
        ) / 10
      : null;

  const complaints = input.yesterdayFeedback
    .filter((row) => row.rating <= 3 && row.comment?.trim())
    .map((row) => row.comment!.trim())
    .slice(0, 3);

  return { revenue, topItem, avgRating, complaints };
}

function buildLowStockAlerts(input: BuildDailyPrepBriefingInput): string[] {
  const stockLines = input.lowStock.map(
    (row) => `${row.productName} — ostalo ${row.remaining} porcije`
  );
  const unavailable = input.unavailableProductNames.map(
    (name) => `${name} — nedostupno na meniju`
  );
  return [...stockLines, ...unavailable].slice(0, 5);
}

function buildTodayFocus(input: BuildDailyPrepBriefingInput): string[] {
  const focus: string[] = [];
  const weather = input.weather;

  if (weather && weather.temp >= 30) {
    focus.push(
      `Ponudi hladna pića proaktivno (${Math.round(weather.temp)}°C danas)`
    );
  } else if (weather?.condition === "rain") {
    focus.push("Kišovit dan — predloži topla jela i kafu.");
  }

  if (input.prepTimeAvgMinutes != null && input.prepTimeAvgMinutes >= 15) {
    focus.push(
      `Kitchen prep time ~${input.prepTimeAvgMinutes} min — provjeri workflow u peak satima.`
    );
  }

  const waitCount = input.waitTimeComplaintCount ?? 0;
  if (waitCount >= 2) {
    focus.push(
      `${waitCount} pritužbe na čekanje juče — fokus na komunikaciju s gostima.`
    );
  }

  const vipGuests = input.returningGuests.filter((row) => row.isVip);
  if (vipGuests.length > 0) {
    focus.push(
      `Personalizuj doček za ${vipGuests.length} VIP gosta${vipGuests.length === 1 ? "" : "a"}.`
    );
  }

  if (input.lowStock.length > 0) {
    focus.push(
      `Provjeri zalihe: ${input.lowStock
        .slice(0, 2)
        .map((row) => row.productName)
        .join(", ")}.`
    );
  }

  return focus.slice(0, 5);
}

/** O2 — deterministic morning staff briefing (max ~1 page). */
export function buildDailyPrepBriefing(
  input: BuildDailyPrepBriefingInput
): DailyPrepBriefing {
  const returning = input.returningGuests.filter((row) => row.visitCount >= 1);
  const vipNames = returning.filter((row) => row.isVip).map(guestSummary);
  const predictedBusyness = derivePredictedBusyness({
    rhythmStress: input.rhythmStress,
    weekday: input.weekday,
  });
  const yesterdayHighlights = buildYesterdayHighlights(input);
  const fiscalSummaryLine = input.yesterdayFiscal
    ? formatYesterdayFiscalSummaryLine(input.yesterdayFiscal)
    : null;

  return {
    date: input.date,
    venueName: input.venueName,
    sections: {
      weather: input.weather ?? null,
      predictedBusyness,
      returningGuests: {
        count: returning.length,
        vipNames,
      },
      lowStockAlerts: buildLowStockAlerts(input),
      menuChanges: input.menuChanges.slice(0, 5),
      yesterdayHighlights: {
        ...yesterdayHighlights,
        fiscalSummaryLine,
      },
      todayFocus: buildTodayFocus(input),
      demandForecast: (input.demandForecastLines ?? []).slice(0, 6),
    },
  };
}

export function formatDailyPrepBriefingTitle(
  briefing: DailyPrepBriefing,
  weekdayLabel: string
): string {
  const [year, month, day] = briefing.date.split("-");
  const formattedDate = `${day}.${month}.${year?.slice(2)}.`;
  return `☀️ JUTARNJI BRIEFING — ${briefing.venueName} — ${weekdayLabel} ${formattedDate}`;
}

export function formatDailyPrepBriefingText(
  briefing: DailyPrepBriefing,
  options?: { weekdayLabel?: string; currencyLabel?: string }
): string {
  const weekdayLabel =
    options?.weekdayLabel ??
    DAY_NAMES_SR[new Date(`${briefing.date}T12:00:00`).getDay()] ??
    briefing.date;
  const currency = options?.currencyLabel ?? "RSD";
  const { sections } = briefing;

  const busynessParts = [busynessLabel(sections.predictedBusyness)];
  if (sections.weather?.condition === "sunny") {
    busynessParts.push("sunčano");
  } else if (sections.weather?.condition === "rain") {
    busynessParts.push("kiša");
  }

  const lines = [
    formatDailyPrepBriefingTitle(briefing, weekdayLabel),
    "",
    `📊 PROGNOZA: ${busynessParts.join(" + ")}`,
  ];

  if (sections.weather) {
    lines.push(
      `🌤️ VREME: ${Math.round(sections.weather.temp)}°C, ${sections.weather.condition} — ${sections.weather.suggestion}`
    );
  }

  if (sections.returningGuests.count > 0) {
    const guestLine =
      sections.returningGuests.vipNames.length > 0
        ? sections.returningGuests.vipNames.join("; ")
        : `${sections.returningGuests.count} returning gosta očekivano`;
    lines.push(
      `🔁 GOSTI: ${sections.returningGuests.count} returning (${guestLine})`
    );
  }

  if (sections.lowStockAlerts.length > 0) {
    lines.push(`⚠️ STOCK: ${sections.lowStockAlerts.join(" · ")}`);
  }

  if (sections.menuChanges.length > 0) {
    lines.push(`📋 MENI: ${sections.menuChanges.join(" · ")}`);
  }

  const ratingLabel =
    sections.yesterdayHighlights.avgRating != null
      ? `${sections.yesterdayHighlights.avgRating} ⭐`
      : "—";
  lines.push(
    `📈 JUČER: ${formatMoney(sections.yesterdayHighlights.revenue, currency)} | Top: ${sections.yesterdayHighlights.topItem} | Rating: ${ratingLabel}`
  );

  if (sections.yesterdayHighlights.fiscalSummaryLine) {
    lines.push(`🧾 FISKAL: ${sections.yesterdayHighlights.fiscalSummaryLine}`);
  }

  if (sections.yesterdayHighlights.complaints.length > 0) {
    lines.push(
      `💬 PRITUŽBE: ${sections.yesterdayHighlights.complaints.join(" · ")}`
    );
  }

  if (sections.todayFocus.length > 0) {
    lines.push("💡 FOKUS:");
    lines.push(...sections.todayFocus.map((line) => `- ${line}`));
  }

  if (sections.demandForecast.length > 0) {
    lines.push("");
    lines.push("📊 PROGNOZA POTRAŽNJE:");
    lines.push(...sections.demandForecast.map((line) => `- ${line}`));
  }

  return lines.join("\n");
}

export function formatDailyPrepBriefingHtml(
  briefing: DailyPrepBriefing,
  options?: { weekdayLabel?: string; currencyLabel?: string }
): string {
  const text = formatDailyPrepBriefingText(briefing, options);
  const body = text
    .split("\n")
    .map((line) => (line ? `<p style="margin:0 0 8px;">${line}</p>` : ""))
    .join("");

  return `<div style="font-family:Inter,Segoe UI,sans-serif;color:#111;max-width:560px;">${body}</div>`;
}

export function formatDailyPrepCopilotLines(
  briefing: DailyPrepBriefing
): string[] {
  const { sections } = briefing;
  const lines: string[] = [
    `Prognoza: ${busynessLabel(sections.predictedBusyness)}`,
  ];

  if (sections.returningGuests.count > 0) {
    lines.push(
      `Returning gosti: ${sections.returningGuests.count}${
        sections.returningGuests.vipNames.length
          ? ` (${sections.returningGuests.vipNames.slice(0, 2).join("; ")})`
          : ""
      }`
    );
  }

  if (sections.lowStockAlerts.length > 0) {
    lines.push(`Stock: ${sections.lowStockAlerts.slice(0, 2).join(" · ")}`);
  }

  if (sections.todayFocus.length > 0) {
    lines.push(`Fokus: ${sections.todayFocus[0]}`);
  }

  if (sections.yesterdayHighlights.fiscalSummaryLine) {
    lines.push(sections.yesterdayHighlights.fiscalSummaryLine);
  }

  if (sections.demandForecast.length > 0) {
    lines.push(`Prognoza: ${sections.demandForecast[0]}`);
  }

  return lines.slice(0, 5);
}

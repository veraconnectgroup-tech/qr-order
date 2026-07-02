import type { DailyReport } from "@/lib/admin/build-daily-report";

/** Bar/kitchen avg prep above this (min) on ≥ MIN_DAYS_FOR_DELAY_REC days triggers recommendation. */
export const WEEKLY_STATION_DELAY_THRESHOLD_MINUTES = 8;
export const WEEKLY_STATION_DELAY_MIN_DAYS = 3;
/** Recovery cases in week above this → owner action line. */
export const WEEKLY_RECOVERY_CASES_THRESHOLD = 2;
/** Upsell revenue below this with ≥ MIN_ORDER_DAYS active days → push menu focus. */
export const WEEKLY_UPSELL_LOW_THRESHOLD = 500;
export const WEEKLY_ACTIVE_ORDER_DAYS = 4;

export type WeeklyOwnerReport = {
  weekEnding: string;
  weekStart: string;
  venueName: string;
  currencyLabel: string;
  daysLoaded: number;
  isQuietWeek: boolean;
  sections: {
    headline: string;
    topProducts: Array<{ name: string; quantity: number; revenue: number }>;
    flopProducts: Array<{ name: string; quantity: number; revenue: number }>;
    avgTurnaroundByDay: Array<{ date: string; minutes: number | null }>;
    stationDelayTrend: Array<{
      station: "kitchen" | "bar";
      avgMinutes: number;
      peakDay: string;
    }>;
    denisStats: {
      upsellRevenue: number;
      recoveryCases: number;
      preventedProblems: number;
      totalOrders: number;
    };
    recommendations: string[];
  };
};

export type WeeklyOwnerReportDigest = {
  subject: string;
  text: string;
  html: string;
};

function shiftDate(date: string, deltaDays: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function aggregateProducts(
  reports: DailyReport[]
): Array<{ name: string; quantity: number; revenue: number }> {
  const totals = new Map<string, { quantity: number; revenue: number }>();
  for (const report of reports) {
    for (const row of report.sections.productRollup) {
      const existing = totals.get(row.name) ?? { quantity: 0, revenue: 0 };
      totals.set(row.name, {
        quantity: existing.quantity + row.quantity,
        revenue: existing.revenue + row.revenue,
      });
    }
  }
  return [...totals.entries()]
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.quantity - a.quantity);
}

function detectQuietWeek(reports: DailyReport[]): boolean {
  if (reports.length === 0) return true;

  const hasActivity = reports.some((r) => r.sections.revenue.orderCount > 0);
  if (!hasActivity) return true;

  const hasIssues = reports.some(
    (r) =>
      r.sections.issues.length > 0 ||
      r.sections.denisShift.serviceRecovery.casesOpened > 0 ||
      r.sections.denisShift.eightySixEvents.length > 0 ||
      r.sections.denisShift.escalations.total > 0
  );
  return !hasIssues;
}

function buildRecommendations(
  reports: DailyReport[],
  stationDelayTrend: WeeklyOwnerReport["sections"]["stationDelayTrend"],
  denisStats: WeeklyOwnerReport["sections"]["denisStats"]
): string[] {
  const recs: string[] = [];

  for (const trend of stationDelayTrend) {
    const slowDays = reports.filter((report) => {
      const delay = report.sections.denisShift.stationDelays.find(
        (row) => row.station === trend.station
      );
      return (
        delay?.avgPrepMinutes != null &&
        delay.avgPrepMinutes >= WEEKLY_STATION_DELAY_THRESHOLD_MINUTES &&
        delay.sampleCount > 0
      );
    });
    if (slowDays.length >= WEEKLY_STATION_DELAY_MIN_DAYS) {
      const label = trend.station === "bar" ? "Bar" : "Kuhinja";
      recs.push(
        `${label} kasni prosečno ${trend.avgMinutes} min posle gužve (${slowDays.length} dana) — razmisli o dodatnom osoblju u peak smeni.`
      );
    }
  }

  if (denisStats.recoveryCases >= WEEKLY_RECOVERY_CASES_THRESHOLD) {
    recs.push(
      `${denisStats.recoveryCases} service recovery slučaja ove nedelje — prođi kroz training oko brze reakcije menadžera.`
    );
  }

  const activeDays = reports.filter((r) => r.sections.revenue.orderCount > 0)
    .length;
  if (
    activeDays >= WEEKLY_ACTIVE_ORDER_DAYS &&
    denisStats.upsellRevenue < WEEKLY_UPSELL_LOW_THRESHOLD
  ) {
    recs.push(
      `Denis upsell +${Math.round(denisStats.upsellRevenue)} ${reports[0]?.currencyLabel ?? "RSD"} — ispod ${WEEKLY_UPSELL_LOW_THRESHOLD}; proveri pairing i desert prozor u peak satima.`
    );
  }

  if (denisStats.preventedProblems >= 5) {
    recs.push(
      `Denis je sprečio ${denisStats.preventedProblems} eskalacija — zadrži station Q&A rutinu u smeni.`
    );
  }

  return recs.slice(0, 4);
}

/** Rollup stored daily reports only — no historical recompute. */
export function buildWeeklyOwnerReport(input: {
  reports: DailyReport[];
  weekEnding: string;
}): WeeklyOwnerReport {
  const sorted = [...input.reports].sort((a, b) => a.date.localeCompare(b.date));
  const venueName = sorted[0]?.venueName ?? "Lokacija";
  const currencyLabel = sorted[0]?.currencyLabel ?? "RSD";
  const weekStart =
    sorted[0]?.date ?? shiftDate(input.weekEnding, -6);

  const products = aggregateProducts(sorted);
  const topProducts = products.slice(0, 5);
  const flopProducts = [...products]
    .filter((row) => row.quantity > 0)
    .sort((a, b) => a.quantity - b.quantity)
    .slice(0, 5);

  const avgTurnaroundByDay = sorted.map((report) => ({
    date: report.date,
    minutes: report.sections.denisShift.tableTurnaround.avgTurnaroundMinutes,
  }));

  const stationDelayTrend: WeeklyOwnerReport["sections"]["stationDelayTrend"] =
    [];
  for (const station of ["kitchen", "bar"] as const) {
    const values: Array<{ date: string; minutes: number }> = [];
    for (const report of sorted) {
      const row = report.sections.denisShift.stationDelays.find(
        (entry) => entry.station === station
      );
      if (row?.avgPrepMinutes != null && row.sampleCount > 0) {
        values.push({ date: report.date, minutes: row.avgPrepMinutes });
      }
    }
    if (values.length === 0) continue;
    const avgMinutes = Math.round(
      values.reduce((sum, row) => sum + row.minutes, 0) / values.length
    );
    const peak = values.sort((a, b) => b.minutes - a.minutes)[0]!;
    stationDelayTrend.push({
      station,
      avgMinutes,
      peakDay: peak.date,
    });
  }

  const denisStats = {
    upsellRevenue: sorted.reduce(
      (sum, r) => sum + r.sections.denis.upsellRevenue,
      0
    ),
    recoveryCases: sorted.reduce(
      (sum, r) => sum + r.sections.denisShift.serviceRecovery.casesOpened,
      0
    ),
    preventedProblems: sorted.reduce(
      (sum, r) => sum + r.sections.denisShift.preventedProblems,
      0
    ),
    totalOrders: sorted.reduce(
      (sum, r) => sum + r.sections.revenue.orderCount,
      0
    ),
  };

  const isQuietWeek = detectQuietWeek(sorted);
  const recommendations = isQuietWeek
    ? []
    : buildRecommendations(sorted, stationDelayTrend, denisStats);

  const headline = isQuietWeek
    ? "Mirna nedelja — nema operativnih problema za eskalaciju."
    : `${denisStats.totalOrders} narudžbi · Denis upsell +${Math.round(denisStats.upsellRevenue).toLocaleString("sr-RS")} ${currencyLabel}`;

  return {
    weekEnding: input.weekEnding,
    weekStart,
    venueName,
    currencyLabel,
    daysLoaded: sorted.length,
    isQuietWeek,
    sections: {
      headline,
      topProducts,
      flopProducts,
      avgTurnaroundByDay,
      stationDelayTrend,
      denisStats,
      recommendations,
    },
  };
}

export function formatWeeklyOwnerReportDigest(
  report: WeeklyOwnerReport
): WeeklyOwnerReportDigest {
  const { sections: s } = report;
  const money = (n: number) =>
    `${Math.round(n).toLocaleString("sr-RS")} ${report.currencyLabel}`;

  const lines = [
    `📅 NEDELJNI IZVJEŠTAJ — ${report.venueName}`,
    `${report.weekStart} → ${report.weekEnding} (${report.daysLoaded} dana u store-u)`,
    "",
    s.headline,
  ];

  if (!report.isQuietWeek) {
    if (s.topProducts.length) {
      lines.push(
        "",
        "🏆 TOP 5:",
        ...s.topProducts.map(
          (row, i) =>
            `${i + 1}. ${row.name} — ${row.quantity} kom · ${money(row.revenue)}`
        )
      );
    }
    if (s.flopProducts.length) {
      lines.push(
        "",
        "📉 FLOP 5 (najmanje prodato):",
        ...s.flopProducts.map(
          (row, i) => `${i + 1}. ${row.name} — ${row.quantity} kom`
        )
      );
    }
    const turnaroundParts = s.avgTurnaroundByDay
      .filter((row) => row.minutes != null)
      .map((row) => `${row.date.slice(5)}: ${row.minutes} min`);
    if (turnaroundParts.length) {
      lines.push("", `🔄 Obrt po danu: ${turnaroundParts.join(" · ")}`);
    }
    if (s.stationDelayTrend.length) {
      lines.push(
        "",
        "⏱ Kašnjenja po stanici:",
        ...s.stationDelayTrend.map((row) => {
          const label = row.station === "bar" ? "Bar" : "Kuhinja";
          return `${label}: ${row.avgMinutes} min prosečno (peak ${row.peakDay})`;
        })
      );
    }
    lines.push(
      "",
      `🤖 Denis: upsell ${money(s.denisStats.upsellRevenue)} · recovery ${s.denisStats.recoveryCases} · sprečeno ${s.denisStats.preventedProblems}`
    );
    if (s.recommendations.length) {
      lines.push("", "💡 PREPORUKE:");
      lines.push(...s.recommendations.map((line) => `- ${line}`));
    }
  }

  const htmlBody = lines
    .map((line) =>
      line.startsWith("- ")
        ? `<li>${line.slice(2)}</li>`
        : line
          ? `<p style="margin:0 0 8px;">${line}</p>`
          : ""
    )
    .join("");

  return {
    subject: `Denis nedeljni izveštaj — ${report.venueName}${report.isQuietWeek ? " (mirna nedelja)" : ""}`,
    text: lines.join("\n"),
    html: `<div style="font-family:Inter,Segoe UI,sans-serif;color:#111;max-width:620px;line-height:1.45;">${htmlBody}</div>`,
  };
}

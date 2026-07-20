import type { FeedbackRow } from "@/lib/denis/platform/feedback-intelligence";
import type { DenisHealthMetrics } from "@/lib/denis/monitoring";
import {
  buildDenisShiftRecap,
  emptyDenisShiftRecap,
  type BuildDenisShiftRecapInput,
  type DenisShiftRecap,
} from "@/lib/admin/denis-shift-report";
import {
  buildSuspiciousDigest,
  type SuspiciousDigest,
} from "@/lib/loss-prevention/build-suspicious-digest";
import type { OpenSuspiciousFlag } from "@/lib/loss-prevention/load-open-suspicious-flags";
import {
  countDiscountsByStaff,
  evaluateDiscountPattern,
  type DiscountPatternResult,
} from "@/lib/loss-prevention/discount-patterns";
import type { SensitiveActionRow } from "@/lib/audit/sensitive-action-types";

export type DailyReportProductRollupRow = {
  name: string;
  quantity: number;
  revenue: number;
};

export type DailyReportOrderRow = {
  id: string;
  total: number;
  created_at: string;
  session_id: string | null;
  guest_token: string | null;
};

export type DailyReportSessionRow = {
  id: string;
  opened_at: string;
  denis_shared_ai_session_id: string | null;
  guest_token: string | null;
};

export type DailyReport = {
  date: string;
  venueName: string;
  weekdayLabel: string;
  currencyLabel: string;
  sections: {
    revenue: {
      total: number;
      vsYesterday: number;
      vsLastWeekSameDay: number;
      avgOrderValue: number;
      orderCount: number;
    };
    denis: {
      sessionsHandled: number;
      upsellRevenue: number;
      upsellConversionRate: number;
      proactiveNudgesSent: number;
      nudgeAcceptRate: number;
      avgResponseTime: number;
      creditsBurned: number;
    };
    guest: {
      uniqueGuests: number;
      returningGuests: number;
      newGuests: number;
      avgRating: number | null;
      feedbackCount: number;
      topComplaint: string | null;
    };
    kitchen: {
      avgPrepTime: number;
      slowestItem: { name: string; avgMinutes: number };
      peakHour: string;
      peakOrderCount: number;
    };
    highlights: string[];
    issues: string[];
    /** ADR-044 — owner suspicious digest (neutral tone). */
    lossPrevention: {
      lines: string[];
      totalFlags: number;
      overflow: number;
    };
    /** ADR-044 S6 — per-staff discount-rate deviation flags (report/monitoring signal only). */
    discountPatternFlags: DiscountPatternResult[];
    denisShift: DenisShiftRecap;
    /** Per-day product rollup for weekly owner report (S14). */
    productRollup: DailyReportProductRollupRow[];
  };
};

export type BuildDailyReportInput = {
  date: string;
  venueName: string;
  weekdayLabel: string;
  currencyLabel: string;
  orders: DailyReportOrderRow[];
  sessions: DailyReportSessionRow[];
  feedback: FeedbackRow[];
  denisMetrics: DailyReport["sections"]["denis"];
  revenueYesterday: number;
  revenueLastWeekSameDay: number;
  prepTimeAvgMinutes: number | null;
  slowestItem: { name: string; avgMinutes: number } | null;
  peakHour: string;
  peakOrderCount: number;
  returningGuestSessions: number;
  newGuestSessions: number;
  denisShift?: BuildDenisShiftRecapInput;
  productRollup?: DailyReportProductRollupRow[];
  suspiciousFlags?: OpenSuspiciousFlag[];
  suspiciousDigestMaxItems?: number;
  /** Sensitive-action rows (action="discount") for the report period, used to build discountPatternFlags. */
  discountActionRows?: SensitiveActionRow[];
  /** ADR-044 loss-prevention gates. Omitted (e.g. in older tests) preserves prior unconditional behavior. */
  lossPreventionConfig?: {
    enabled: boolean;
    suspiciousReportEnabled: boolean;
    discountPatternsEnabled: boolean;
    discountDeviationMultiplier: number;
  };
};

export function aggregateProductRollupFromItems(
  items: Array<{ productName: string; quantity: number; total: number }>
): DailyReportProductRollupRow[] {
  const totals = new Map<string, { quantity: number; revenue: number }>();
  for (const row of items) {
    const name = row.productName.trim() || "Artikal";
    const existing = totals.get(name) ?? { quantity: 0, revenue: 0 };
    totals.set(name, {
      quantity: existing.quantity + row.quantity,
      revenue: existing.revenue + row.total,
    });
  }
  return [...totals.entries()]
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.quantity - a.quantity);
}

function pctChange(current: number, baseline: number): number {
  if (baseline <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - baseline) / baseline) * 1000) / 10;
}

function formatMoney(amount: number, currencyLabel: string): string {
  return `${Math.round(amount).toLocaleString("sr-RS")} ${currencyLabel}`;
}

function complaintLabel(category: string | null): string {
  if (!category) return "ostalo";
  if (category === "wait_time") return "čekanje";
  if (category === "food") return "hrana";
  if (category === "service") return "usluga";
  return category;
}

function buildHighlightsAndIssues(input: BuildDailyReportInput): {
  highlights: string[];
  issues: string[];
} {
  const highlights: string[] = [];
  const issues: string[] = [];
  const revenueTotal = input.orders.reduce(
    (sum, row) => sum + Number(row.total ?? 0),
    0
  );

  const vsWeek = pctChange(revenueTotal, input.revenueLastWeekSameDay);
  if (vsWeek >= 8) {
    highlights.push(`Prihod +${vsWeek}% vs isti dan prošle sedmice`);
  }

  const returningShare =
    input.sessions.length > 0
      ? input.returningGuestSessions / input.sessions.length
      : 0;
  if (returningShare >= 0.15 && input.returningGuestSessions >= 3) {
    highlights.push(
      `Returning guest udeo ${Math.round(returningShare * 100)}% (${input.returningGuestSessions} sesija)`
    );
  }

  if (input.denisMetrics.upsellConversionRate >= 0.12) {
    highlights.push(
      `Denis upsell konverzija ${Math.round(input.denisMetrics.upsellConversionRate * 100)}%`
    );
  }

  if (input.denisMetrics.nudgeAcceptRate >= 0.3) {
    highlights.push(
      `Nudge accept rate ${Math.round(input.denisMetrics.nudgeAcceptRate * 100)}%`
    );
  }

  const avgRating =
    input.feedback.length > 0
      ? input.feedback.reduce((sum, row) => sum + row.rating, 0) /
        input.feedback.length
      : null;
  if (avgRating != null && avgRating >= 4.2) {
    highlights.push(`Prosečna ocena gostiju ${avgRating.toFixed(1)} ⭐`);
  }

  if (revenueTotal === 0) {
    issues.push("Nema narudžbi danas — proverite QR i Denis aktivnost");
  }

  const negativeFeedback = input.feedback.filter(
    (row) => row.sentiment === "negative"
  );
  if (negativeFeedback.length >= 2) {
    const counts = new Map<string, number>();
    for (const row of negativeFeedback) {
      const key = complaintLabel(row.category);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) {
      issues.push(`Top žalba: „${top[0]}" (${top[1]}×)`);
    }
  }

  if (
    input.slowestItem &&
    input.prepTimeAvgMinutes != null &&
    input.slowestItem.avgMinutes > input.prepTimeAvgMinutes * 1.35
  ) {
    issues.push(
      `${input.slowestItem.name} prep time raste (${input.slowestItem.avgMinutes} min) — proveriti stanicu`
    );
  }

  if (input.denisMetrics.avgResponseTime > 5000) {
    issues.push(
      `Denis avg odgovor ${(input.denisMetrics.avgResponseTime / 1000).toFixed(1)}s — proveriti health dashboard`
    );
  }

  const denisShift = input.denisShift
    ? buildDenisShiftRecap(input.denisShift)
    : emptyDenisShiftRecap(input.prepTimeAvgMinutes);

  if (denisShift.preventedProblems > 0) {
    highlights.push(
      `Denis sprečio ${denisShift.preventedProblems} problema (odgovor pre isteka pitanja)`
    );
  }

  const expiredQuestions = denisShift.stationQuestions.reduce(
    (sum, row) => sum + row.expired,
    0
  );
  if (expiredQuestions >= 2) {
    issues.push(
      `${expiredQuestions} station pitanja isteklo bez odgovora — proveriti KDS/bar`
    );
  }

  if (denisShift.riskiestTable && denisShift.riskiestTable.riskScore >= 4) {
    issues.push(
      `Najrizičniji sto: ${denisShift.riskiestTable.tableName} (${denisShift.riskiestTable.questionCount} pitanja, ${denisShift.riskiestTable.escalationCount} eskalacija)`
    );
  }

  if (highlights.length === 0 && revenueTotal > 0) {
    highlights.push("Stabilan radni dan — bez izuzetnih skokova");
  }

  if (issues.length === 0 && revenueTotal === 0) {
    issues.push("Prazan dan — signal za follow-up sutra ujutru");
  }

  return {
    highlights: highlights.slice(0, 3),
    issues: issues.slice(0, 3),
  };
}

/**
 * Per-staff discount deviation flags for the report period — ADR-044 S6.
 *
 * Judgment call: there is no richer historical per-staff discount baseline
 * wired up yet, so "location average" is approximated as this period's total
 * discount count spread evenly across the staff who applied at least one
 * discount (total / distinct staff). This is coarser than a rolling
 * historical average but keeps the check honest with only in-period data —
 * revisit if/when a longer-window baseline becomes available.
 */
function buildDiscountPatternFlags(
  rows: SensitiveActionRow[],
  deviationMultiplier: number | undefined
): DiscountPatternResult[] {
  const counts = countDiscountsByStaff(rows);
  if (counts.size === 0) return [];

  const totalDiscounts = [...counts.values()].reduce((sum, n) => sum + n, 0);
  const locationAverage = totalDiscounts / counts.size;

  const flagged: DiscountPatternResult[] = [];
  for (const [staffId, discountCount] of counts) {
    const result = evaluateDiscountPattern({
      staffId,
      discountCount,
      locationAverage,
      deviationMultiplier,
    });
    if (result.flagged) flagged.push(result);
  }
  return flagged;
}

export function buildDailyReport(input: BuildDailyReportInput): DailyReport {
  const orderCount = input.orders.length;
  const revenueTotal = input.orders.reduce(
    (sum, row) => sum + Number(row.total ?? 0),
    0
  );
  const avgOrderValue = orderCount ? revenueTotal / orderCount : 0;

  const avgRating =
    input.feedback.length > 0
      ? Math.round(
          (input.feedback.reduce((sum, row) => sum + row.rating, 0) /
            input.feedback.length) *
            10
        ) / 10
      : null;

  const negativeCounts = new Map<string, number>();
  for (const row of input.feedback.filter((f) => f.sentiment === "negative")) {
    const key = complaintLabel(row.category);
    negativeCounts.set(key, (negativeCounts.get(key) ?? 0) + 1);
  }
  const topComplaint =
    [...negativeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const { highlights, issues } = buildHighlightsAndIssues(input);

  const denisShift = input.denisShift
    ? buildDenisShiftRecap(input.denisShift)
    : emptyDenisShiftRecap(input.prepTimeAvgMinutes);

  const lossPreventionEnabled = input.lossPreventionConfig?.enabled ?? true;
  const suspiciousReportEnabled =
    input.lossPreventionConfig?.suspiciousReportEnabled ?? true;
  const discountPatternsEnabled =
    input.lossPreventionConfig?.discountPatternsEnabled ?? true;

  const suspiciousDigest: SuspiciousDigest =
    lossPreventionEnabled && suspiciousReportEnabled
      ? buildSuspiciousDigest(
          input.suspiciousFlags ?? [],
          input.suspiciousDigestMaxItems ?? 10
        )
      : { totalFlags: 0, shown: 0, overflow: 0, sections: [], lines: [] };

  const discountPatternFlags: DiscountPatternResult[] =
    lossPreventionEnabled && discountPatternsEnabled
      ? buildDiscountPatternFlags(
          input.discountActionRows ?? [],
          input.lossPreventionConfig?.discountDeviationMultiplier
        )
      : [];

  return {
    date: input.date,
    venueName: input.venueName,
    weekdayLabel: input.weekdayLabel,
    currencyLabel: input.currencyLabel,
    sections: {
      revenue: {
        total: revenueTotal,
        vsYesterday: pctChange(revenueTotal, input.revenueYesterday),
        vsLastWeekSameDay: pctChange(
          revenueTotal,
          input.revenueLastWeekSameDay
        ),
        avgOrderValue,
        orderCount,
      },
      denis: input.denisMetrics,
      guest: {
        uniqueGuests: input.sessions.length,
        returningGuests: input.returningGuestSessions,
        newGuests: input.newGuestSessions,
        avgRating,
        feedbackCount: input.feedback.length,
        topComplaint,
      },
      kitchen: {
        avgPrepTime: input.prepTimeAvgMinutes ?? 0,
        slowestItem: input.slowestItem ?? { name: "—", avgMinutes: 0 },
        peakHour: input.peakHour,
        peakOrderCount: input.peakOrderCount,
      },
      highlights,
      issues,
      lossPrevention: {
        lines: suspiciousDigest.lines,
        totalFlags: suspiciousDigest.totalFlags,
        overflow: suspiciousDigest.overflow,
      },
      discountPatternFlags,
      denisShift,
      productRollup: input.productRollup ?? [],
    },
  };
}

export type DailyReportDigest = {
  subject: string;
  text: string;
  html: string;
};

function signedPct(value: number): string {
  return value >= 0 ? `+${value}%` : `${value}%`;
}

function formatStationQuestionLine(
  row: DenisShiftRecap["stationQuestions"][number]
): string {
  const avg =
    row.avgAnswerMinutes != null ? `${row.avgAnswerMinutes} min avg` : "—";
  return `${row.station}: ${row.asked} pitanja, ${row.answered} odgov., ${row.expired} isteklo (${avg})`;
}

function formatEightySixDigestLines(
  events: DenisShiftRecap["eightySixEvents"]
): string[] {
  if (!events.length) return ["86 danas: nema"];
  const formatter = new Intl.DateTimeFormat("sr-RS", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return [
    `86 danas: ${events.length}`,
    ...events.map(
      (event) =>
        `  ${formatter.format(new Date(event.at))} — ${event.productName}`
    ),
  ];
}

function formatDessertWindowDigestLines(
  stats: DenisShiftRecap["dessertWindow"],
  currencyLabel: string
): string[] {
  if (stats.proposed === 0) {
    return ["Desert prozor: nema predloga danas"];
  }
  const acceptPct =
    stats.proposed > 0
      ? Math.round((stats.accepted / stats.proposed) * 100)
      : 0;
  return [
    `Desert prozor: ${stats.proposed} predloženo, ${stats.accepted} prihvaćeno (${acceptPct}%), ${stats.declined} odbijeno`,
    `  Vrednost prihvaćenih: ${Math.round(stats.valueEuros).toLocaleString("sr-RS")} ${currencyLabel}`,
  ];
}

function formatReturningGuestDigestLines(
  stats: DenisShiftRecap["returningGuests"],
  currencyLabel: string
): string[] {
  if (stats.recognizedToday === 0) {
    return ["Stalni gosti: nema prepoznatih povrataka danas"];
  }
  const returningRounded = Math.round(stats.returningAvgSpend).toLocaleString(
    "sr-RS"
  );
  const venueRounded = Math.round(stats.venueAvgSpend).toLocaleString("sr-RS");
  const delta =
    stats.venueAvgSpend > 0
      ? Math.round(
          ((stats.returningAvgSpend - stats.venueAvgSpend) /
            stats.venueAvgSpend) *
            100
        )
      : 0;
  const deltaLabel = delta >= 0 ? `+${delta}%` : `${delta}%`;
  return [
    `Stalni gosti: ${stats.recognizedToday} prepoznato danas`,
    `  Prosečna potrošnja: ${returningRounded} ${currencyLabel} vs lokacija ${venueRounded} ${currencyLabel} (${deltaLabel})`,
  ];
}

function formatServiceRecoveryDigestLines(
  stats: DenisShiftRecap["serviceRecovery"]
): string[] {
  if (stats.casesOpened === 0) {
    return ["Service recovery: nema slučajeva danas"];
  }
  const response =
    stats.avgManagerResponseMinutes != null
      ? `${stats.avgManagerResponseMinutes} min prosečno`
      : "—";
  return [
    `Service recovery: ${stats.casesOpened} slučaj(a)`,
    `  Rešeno: ${stats.resolved} · otvoreno: ${stats.unresolved} · reakcija menadžera: ${response}`,
  ];
}

function formatTableTurnaroundDigestLines(
  stats: DenisShiftRecap["tableTurnaround"]
): string[] {
  if (stats.bussedCount === 0 && stats.openAtClose === 0) {
    return ["Obrt stolova: nema bus obaveza danas"];
  }
  const avg =
    stats.avgTurnaroundMinutes != null
      ? `${stats.avgTurnaroundMinutes} min prosečno`
      : "—";
  const worst =
    stats.worstTableName && stats.worstTurnaroundMinutes != null
      ? `${stats.worstTableName} (${stats.worstTurnaroundMinutes} min)`
      : "—";
  return [
    `Obrt stolova: ${stats.bussedCount} raspremljeno · ${avg}`,
    `  Najsporiji: ${worst}${stats.openAtClose > 0 ? ` · otvoreno na kraju dana: ${stats.openAtClose}` : ""}`,
  ];
}

function formatDenisShiftDigestText(
  shift: DenisShiftRecap,
  currencyLabel: string
): string[] {
  const lines = [
    `🔄 DENIS SMENA:`,
    ...shift.stationQuestions.map((row) => formatStationQuestionLine(row)),
    `Eskalacije: ${shift.escalations.total} (${Object.entries(shift.escalations.byType)
      .map(([type, count]) => `${type} ${count}`)
      .join(", ") || "nema"})`,
    shift.riskiestTable
      ? `Najrizičniji sto: ${shift.riskiestTable.tableName} (${shift.riskiestTable.questionCount} pitanja, ${shift.riskiestTable.escalationCount} eskal., ${shift.riskiestTable.waiterCallCount} poziva)`
      : `Najrizičniji sto: nema signala`,
    ...shift.stationDelays.map((row) => {
      const avg =
        row.avgPrepMinutes != null
          ? `${row.avgPrepMinutes} min${row.sampleCount ? "" : " (prior)"}`
          : "—";
      return `${row.station} prep: ${avg}`;
    }),
    `Sprečeni problemi: ${shift.preventedProblems}`,
    ...formatEightySixDigestLines(shift.eightySixEvents),
    ...formatDessertWindowDigestLines(shift.dessertWindow, currencyLabel),
    ...formatReturningGuestDigestLines(shift.returningGuests, currencyLabel),
    ...formatServiceRecoveryDigestLines(shift.serviceRecovery),
    ...formatTableTurnaroundDigestLines(shift.tableTurnaround),
  ];
  return lines;
}

function formatDenisShiftDigestHtml(
  shift: DenisShiftRecap,
  currencyLabel: string
): string {
  const escalationSummary =
    Object.entries(shift.escalations.byType)
      .map(([type, count]) => `${type} ${count}`)
      .join(", ") || "nema";

  const delayLines = shift.stationDelays
    .map((row) => {
      const avg =
        row.avgPrepMinutes != null
          ? `${row.avgPrepMinutes} min${row.sampleCount ? "" : " (prior)"}`
          : "—";
      return `<li>${row.station}: ${avg}</li>`;
    })
    .join("");

  const eightySixLines = shift.eightySixEvents.length
    ? shift.eightySixEvents
        .map((event) => {
          const time = new Intl.DateTimeFormat("sr-RS", {
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(event.at));
          return `<li>${time} — ${event.productName}</li>`;
        })
        .join("")
    : `<li>Nema</li>`;

  return `
      <p style="margin:0 0 8px;font-weight:600;">🔄 Denis smena</p>
      <ul style="margin:0 0 16px;padding-left:18px;">
        ${shift.stationQuestions.map((row) => `<li>${formatStationQuestionLine(row)}</li>`).join("")}
        <li>Eskalacije: ${shift.escalations.total} (${escalationSummary})</li>
        <li>${shift.riskiestTable ? `Najrizičniji sto: ${shift.riskiestTable.tableName}` : "Najrizičniji sto: nema signala"}</li>
        ${delayLines}
        <li>Sprečeni problemi: ${shift.preventedProblems}</li>
      </ul>
      <p style="margin:0 0 8px;font-weight:600;">🛑 86 danas</p>
      <ul style="margin:0 0 16px;padding-left:18px;">${eightySixLines}</ul>
      <p style="margin:0 0 8px;font-weight:600;">🍰 Desert prozor</p>
      <ul style="margin:0 0 16px;padding-left:18px;">
        ${formatDessertWindowDigestLines(shift.dessertWindow, currencyLabel)
          .map((line) => `<li>${line}</li>`)
          .join("")}
      </ul>
      <p style="margin:0 0 8px;font-weight:600;">🔁 Stalni gosti</p>
      <ul style="margin:0 0 16px;padding-left:18px;">
        ${formatReturningGuestDigestLines(shift.returningGuests, currencyLabel)
          .map((line) => `<li>${line}</li>`)
          .join("")}
      </ul>
      <p style="margin:0 0 8px;font-weight:600;">🩹 Service recovery</p>
      <ul style="margin:0 0 16px;padding-left:18px;">
        ${formatServiceRecoveryDigestLines(shift.serviceRecovery)
          .map((line) => `<li>${line}</li>`)
          .join("")}
      </ul>
      <p style="margin:0 0 8px;font-weight:600;">🔄 Obrt stolova</p>
      <ul style="margin:0 0 16px;padding-left:18px;">
        ${formatTableTurnaroundDigestLines(shift.tableTurnaround)
          .map((line) => `<li>${line}</li>`)
          .join("")}
      </ul>`;
}

export function formatDailyReportDigest(report: DailyReport): DailyReportDigest {
  const { sections: s } = report;
  const money = (n: number) => formatMoney(n, report.currencyLabel);

  const text = [
    `📊 DNEVNI IZVJEŠTAJ — ${report.venueName} — ${report.weekdayLabel} ${report.date}`,
    "",
    `💰 PRIHOD: ${money(s.revenue.total)} (${signedPct(s.revenue.vsYesterday)} vs jučer, ${signedPct(s.revenue.vsLastWeekSameDay)} vs prošli ${report.weekdayLabel.toLowerCase()})`,
    `🧾 Narudžbe: ${s.revenue.orderCount} | Prosj. račun: ${money(s.revenue.avgOrderValue)}`,
    "",
    `🤖 DENIS:`,
    `Sesije: ${s.denis.sessionsHandled} | Upsell: +${money(s.denis.upsellRevenue)} (${Math.round(s.denis.upsellConversionRate * 100)}% konverzija)`,
    `Nudge-ovi: ${s.denis.proactiveNudgesSent} poslano → ${Math.round(s.denis.nudgeAcceptRate * 100)}% prihvaćeno`,
    `Brzina: ${(s.denis.avgResponseTime / 1000).toFixed(1)}s avg | Krediti: ${s.denis.creditsBurned} potrošeno`,
    "",
    `👥 GOSTI:`,
    `Ukupno: ${s.guest.uniqueGuests} | Novi: ${s.guest.newGuests} | Returning: ${s.guest.returningGuests}`,
    s.guest.avgRating != null
      ? `Rating: ${s.guest.avgRating} ⭐ (${s.guest.feedbackCount} ocjena)${s.guest.topComplaint ? ` | Top žalba: „${s.guest.topComplaint}"` : ""}`
      : `Rating: nema ocjena danas`,
    "",
    `🍳 KUHINJA:`,
    `Avg prep: ${s.kitchen.avgPrepTime} min | Najsporiji: ${s.kitchen.slowestItem.name} (${s.kitchen.slowestItem.avgMinutes} min)`,
    `Peak: ${s.kitchen.peakHour} (${s.kitchen.peakOrderCount} narudžbi)`,
    "",
    ...formatDenisShiftDigestText(s.denisShift, report.currencyLabel),
    "",
    ...(s.highlights.length
      ? [`✅ HIGHLIGHT: ${s.highlights.join(" · ")}`]
      : []),
    ...(s.issues.length ? [`⚠️ ZA SUTRA: ${s.issues.join(" · ")}`] : []),
    ...(s.lossPrevention.lines.length
      ? [
          "",
          `🔍 ZA PROVERU (${s.lossPrevention.totalFlags}):`,
          ...s.lossPrevention.lines.map((line) => `• ${line}`),
          ...(s.lossPrevention.overflow > 0
            ? [`… još ${s.lossPrevention.overflow} u dashboardu`]
            : []),
        ]
      : []),
    ...(s.discountPatternFlags.length
      ? [
          "",
          `🏷️ POPUST OBRAZAC (${s.discountPatternFlags.length}):`,
          ...s.discountPatternFlags.map(
            (flag) =>
              `• ${flag.staffId}: ${flag.discountCount} popusta (prosek ${Math.round(flag.locationAverage * 10) / 10}, prag ${Math.round(flag.threshold * 10) / 10})`
          ),
        ]
      : []),
    "",
    "Detalji: Admin → Denis Insights",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family:Inter,Segoe UI,sans-serif;color:#111;max-width:620px;line-height:1.45;">
      <h2 style="margin:0 0 4px;">📊 Dnevni izvještaj</h2>
      <p style="margin:0 0 16px;color:#555;">${report.venueName} · ${report.weekdayLabel} ${report.date}</p>
      <p style="margin:0 0 12px;"><strong>💰 Prihod:</strong> ${money(s.revenue.total)}
        <span style="color:#555;"> (${signedPct(s.revenue.vsYesterday)} vs jučer, ${signedPct(s.revenue.vsLastWeekSameDay)} vs prošli ${report.weekdayLabel.toLowerCase()})</span></p>
      <p style="margin:0 0 16px;">🧾 ${s.revenue.orderCount} narudžbi · prosj. ${money(s.revenue.avgOrderValue)}</p>
      <p style="margin:0 0 8px;font-weight:600;">🤖 Denis</p>
      <ul style="margin:0 0 16px;padding-left:18px;">
        <li>Sesije: ${s.denis.sessionsHandled}</li>
        <li>Upsell: +${money(s.denis.upsellRevenue)} (${Math.round(s.denis.upsellConversionRate * 100)}%)</li>
        <li>Nudge: ${s.denis.proactiveNudgesSent} → ${Math.round(s.denis.nudgeAcceptRate * 100)}% accept</li>
        <li>Brzina: ${(s.denis.avgResponseTime / 1000).toFixed(1)}s · krediti: ${s.denis.creditsBurned}</li>
      </ul>
      <p style="margin:0 0 8px;font-weight:600;">👥 Gosti</p>
      <ul style="margin:0 0 16px;padding-left:18px;">
        <li>${s.guest.uniqueGuests} sesija · novi ${s.guest.newGuests} · returning ${s.guest.returningGuests}</li>
        <li>${s.guest.avgRating != null ? `Rating ${s.guest.avgRating} ⭐ (${s.guest.feedbackCount})` : "Bez ocjena"}${s.guest.topComplaint ? ` · žalba: ${s.guest.topComplaint}` : ""}</li>
      </ul>
      <p style="margin:0 0 8px;font-weight:600;">🍳 Kuhinja</p>
      <ul style="margin:0 0 16px;padding-left:18px;">
        <li>Avg prep ${s.kitchen.avgPrepTime} min · najsporije ${s.kitchen.slowestItem.name} (${s.kitchen.slowestItem.avgMinutes} min)</li>
        <li>Peak ${s.kitchen.peakHour} (${s.kitchen.peakOrderCount} narudžbi)</li>
      </ul>
      ${formatDenisShiftDigestHtml(s.denisShift, report.currencyLabel)}
      ${s.discountPatternFlags.length ? `<p style="margin:0 0 8px;font-weight:600;">🏷️ Popust obrazac</p><ul style="margin:0 0 16px;padding-left:18px;">${s.discountPatternFlags.map((flag) => `<li>${flag.staffId}: ${flag.discountCount} popusta (prosek ${Math.round(flag.locationAverage * 10) / 10}, prag ${Math.round(flag.threshold * 10) / 10})</li>`).join("")}</ul>` : ""}
      ${s.highlights.length ? `<p style="margin:0 0 8px;padding:10px;background:#ecfdf5;border-radius:8px;">✅ ${s.highlights.join(" · ")}</p>` : ""}
      ${s.issues.length ? `<p style="margin:0;padding:10px;background:#fff7ed;border-radius:8px;">⚠️ ${s.issues.join(" · ")}</p>` : ""}
      <p style="margin:16px 0 0;color:#777;font-size:12px;">Admin → Denis Insights</p>
    </div>
  `;

  return {
    subject: `Denis dnevni izvještaj — ${report.venueName} (${money(s.revenue.total)})`,
    text,
    html,
  };
}

export function denisMetricsFromHealth(
  health: DenisHealthMetrics,
  overrides: Partial<DailyReport["sections"]["denis"]> = {}
): DailyReport["sections"]["denis"] {
  return {
    sessionsHandled: overrides.sessionsHandled ?? health.activeSessionCount,
    upsellRevenue: overrides.upsellRevenue ?? 0,
    upsellConversionRate: overrides.upsellConversionRate ?? 0,
    proactiveNudgesSent: overrides.proactiveNudgesSent ?? 0,
    nudgeAcceptRate: overrides.nudgeAcceptRate ?? 0,
    avgResponseTime: overrides.avgResponseTime ?? health.avgResponseMs,
    creditsBurned: overrides.creditsBurned ?? health.creditBurnRatePerHour,
  };
}

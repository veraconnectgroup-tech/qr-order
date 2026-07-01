import type { FeedbackRow } from "@/lib/denis/platform/feedback-intelligence";
import type { DenisHealthMetrics } from "@/lib/denis/monitoring";

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
};

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
    ...(s.highlights.length
      ? [`✅ HIGHLIGHT: ${s.highlights.join(" · ")}`]
      : []),
    ...(s.issues.length ? [`⚠️ ZA SUTRA: ${s.issues.join(" · ")}`] : []),
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

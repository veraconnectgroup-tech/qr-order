import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDailyReportDigest } from "@/lib/admin/build-daily-report";
import {
  buildWeeklyOwnerReport,
  formatWeeklyOwnerReportDigest,
} from "@/lib/admin/build-weekly-owner-report";
import {
  loadStoredDailyReportsForRange,
  markDailyReportSent,
  markWeeklyOwnerReportSent,
  storeDailyReport,
  wasDailyReportSent,
  wasWeeklyOwnerReportSent,
} from "@/lib/admin/daily-report-store";
import { loadDailyReportForLocation } from "@/lib/admin/load-daily-report-context";
import { sendEmail } from "@/lib/email/resend";
import { logger } from "@/lib/logger";
import { notifyLocationPush } from "@/lib/push/notify-location";

async function loadReportRecipients(
  admin: SupabaseClient,
  orgId: string,
  locationId: string
): Promise<string[]> {
  const [{ data: staffRows }, { data: assignedRows }] = await Promise.all([
    admin
      .from("staff")
      .select("id, email, location_id, role")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .in("role", ["owner", "manager"]),
    admin
      .from("staff_locations")
      .select("staff_id")
      .eq("location_id", locationId),
  ]);

  const assignedIds = new Set(
    (assignedRows ?? []).map((row) => (row as { staff_id: string }).staff_id)
  );

  const emails = (staffRows ?? [])
    .filter((row) => {
      const typed = row as {
        id: string;
        location_id: string | null;
        role: string;
      };
      if (typed.role === "owner") return true;
      return typed.location_id === locationId || assignedIds.has(typed.id);
    })
    .map((row) => (row as { email: string | null }).email?.trim() || null)
    .filter((email): email is string => Boolean(email));

  return [...new Set(emails)];
}

async function sendSlackDailyReport(text: string): Promise<boolean> {
  const url = process.env.DENIS_DAILY_REPORT_SLACK_WEBHOOK_URL?.trim();
  if (!url) return false;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    return res.ok;
  } catch (error) {
    logger.warn("Daily report Slack webhook failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/** End-of-day KPI report — email + optional Slack + staff push (T2). */
export async function deliverDailyReport(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    now?: Date;
  }
): Promise<{ sent: boolean; skipped: boolean }> {
  const report = await loadDailyReportForLocation(admin, input);
  if (!report) {
    return { sent: false, skipped: true };
  }

  const alreadySent = await wasDailyReportSent(input.locationId, report.date);
  if (alreadySent) {
    return { sent: false, skipped: true };
  }

  const digest = formatDailyReportDigest(report);
  await storeDailyReport(input.locationId, report);

  const recipients = await loadReportRecipients(
    admin,
    input.orgId,
    input.locationId
  );

  let emailed = 0;
  for (const to of recipients) {
    const result = await sendEmail({
      to,
      subject: digest.subject,
      html: digest.html,
    });
    if ("ok" in result && result.ok) emailed += 1;
  }

  await sendSlackDailyReport(digest.text);

  const { sections: s } = report;
  await notifyLocationPush(input.locationId, {
    title: "Denis — dnevni izvještaj",
    body: `${s.revenue.orderCount} narudžbi · ${Math.round(s.revenue.total).toLocaleString("sr-RS")} ${report.currencyLabel}`,
    url: "/admin/denis-insights",
  });

  await markDailyReportSent(input.locationId, report.date);

  if (emailed === 0) {
    logger.warn("Daily report: no email recipients", {
      locationId: input.locationId,
      orgId: input.orgId,
    });
  }

  return { sent: true, skipped: false };
}

function localDateInTimezone(timezone: string | null, now = new Date()): string {
  const tz = timezone?.trim() || "Europe/Berlin";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Weekly owner rollup — reads stored daily reports only (S14). */
export async function deliverWeeklyOwnerReport(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    now?: Date;
    weekEnding?: string;
  }
): Promise<{ sent: boolean; skipped: boolean }> {
  const { data: locationRow } = await admin
    .from("locations")
    .select("timezone")
    .eq("id", input.locationId)
    .maybeSingle();

  const timezone = (locationRow as { timezone: string | null } | null)?.timezone ?? null;
  const now = input.now ?? new Date();
  const weekEnding =
    input.weekEnding ?? localDateInTimezone(timezone, now);

  const alreadySent = await wasWeeklyOwnerReportSent(
    input.locationId,
    weekEnding
  );
  if (alreadySent) {
    return { sent: false, skipped: true };
  }

  const storedReports = await loadStoredDailyReportsForRange(
    input.locationId,
    weekEnding,
    7
  );
  if (storedReports.length === 0) {
    return { sent: false, skipped: true };
  }

  const weekly = buildWeeklyOwnerReport({
    reports: storedReports,
    weekEnding,
  });
  const digest = formatWeeklyOwnerReportDigest(weekly);
  const recipients = await loadReportRecipients(
    admin,
    input.orgId,
    input.locationId
  );

  let emailed = 0;
  for (const to of recipients) {
    const result = await sendEmail({
      to,
      subject: digest.subject,
      html: digest.html,
    });
    if ("ok" in result && result.ok) emailed += 1;
  }

  await sendSlackDailyReport(digest.text);

  await notifyLocationPush(input.locationId, {
    title: "Denis — nedeljni izveštaj",
    body: weekly.sections.headline.slice(0, 180),
    url: "/admin/denis-insights",
  });

  await markWeeklyOwnerReportSent(input.locationId, weekEnding);

  if (emailed === 0) {
    logger.warn("Weekly owner report: no email recipients", {
      locationId: input.locationId,
      orgId: input.orgId,
    });
  }

  return { sent: true, skipped: false };
}

export async function runWeeklyOwnerReportTick(
  admin: SupabaseClient,
  options?: { limit?: number; now?: Date }
): Promise<{ locations: number; sent: number; skipped: number }> {
  const limit = options?.limit ?? 50;

  const { data: locationRows } = await admin
    .from("locations")
    .select("id, org_id")
    .eq("ai_concierge_enabled", true)
    .limit(limit);

  let sent = 0;
  let skipped = 0;

  for (const row of locationRows ?? []) {
    const locationId = (row as { id: string }).id;
    const orgId = (row as { org_id: string }).org_id;
    const result = await deliverWeeklyOwnerReport(admin, {
      orgId,
      locationId,
      now: options?.now,
    });
    if (result.sent) sent += 1;
    if (result.skipped) skipped += 1;
  }

  return {
    locations: locationRows?.length ?? 0,
    sent,
    skipped,
  };
}

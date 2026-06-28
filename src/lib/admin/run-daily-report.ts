import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDailyReportDigest } from "@/lib/admin/build-daily-report";
import {
  markDailyReportSent,
  wasDailyReportSent,
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

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatDailyPrepBriefingHtml,
  formatDailyPrepBriefingText,
} from "@/lib/admin/build-daily-prep-briefing";
import { loadDailyPrepBriefingForLocation } from "@/lib/admin/load-daily-prep-briefing-context";
import {
  dailyPrepBriefingToCopilotBlock,
  markDailyPrepBriefingSent,
  storeDailyPrepBriefing,
  wasDailyPrepBriefingSent,
} from "@/lib/denis/venue/copilot/daily-prep-briefing-store";
import { buildStaffNotification } from "@/lib/denis/notifications/staff-notifications";
import { persistStaffNotification } from "@/lib/denis/notifications/persist-staff-notification";
import { sendEmail } from "@/lib/email/resend";
import { logger } from "@/lib/logger";
import { notifyLocationPush } from "@/lib/push/notify-location";

async function loadStaffEmails(
  admin: SupabaseClient,
  orgId: string,
  locationId: string
): Promise<string[]> {
  const [{ data: staffRows }, { data: assignedRows }] = await Promise.all([
    admin
      .from("staff")
      .select("id, email, location_id")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .in("role", ["owner", "manager", "staff", "waiter"]),
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
      const typed = row as { id: string; location_id: string | null };
      return typed.location_id === locationId || assignedIds.has(typed.id);
    })
    .map((row) => (row as { email: string | null }).email?.trim() || null)
    .filter((email): email is string => Boolean(email));

  return [...new Set(emails)];
}

export async function deliverDailyPrepBriefing(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    now?: Date;
  }
): Promise<{ sent: boolean; skipped: boolean }> {
  const briefing = await loadDailyPrepBriefingForLocation(admin, {
    locationId: input.locationId,
    orgId: input.orgId,
    now: input.now,
  });

  if (!briefing) {
    return { sent: false, skipped: true };
  }

  const alreadySent = await wasDailyPrepBriefingSent(
    input.locationId,
    briefing.date
  );
  if (alreadySent) {
    return { sent: false, skipped: true };
  }

  await storeDailyPrepBriefing(input.locationId, briefing);

  const subject = `Denis — jutarnji briefing (${briefing.venueName})`;
  const text = formatDailyPrepBriefingText(briefing);
  const html = formatDailyPrepBriefingHtml(briefing);
  const pushBody = dailyPrepBriefingToCopilotBlock(briefing).lines.join(" · ");

  const recipients = await loadStaffEmails(
    admin,
    input.orgId,
    input.locationId
  );

  let emailed = 0;
  for (const to of recipients) {
    const result = await sendEmail({ to, subject, html });
    if ("ok" in result && result.ok) emailed += 1;
  }

  await notifyLocationPush(input.locationId, {
    title: "Denis — jutarnji briefing",
    body: pushBody.slice(0, 180),
    url: "/dashboard/denis",
  });

  const prepLine =
    briefing.sections.demandForecast[0] ??
    dailyPrepBriefingToCopilotBlock(briefing).lines[0] ??
    "Jutarnji kitchen prep briefing je spreman.";

  await persistStaffNotification(admin, {
    orgId: input.orgId,
    locationId: input.locationId,
    notification: buildStaffNotification({
      type: "kitchen_prep_brief",
      message: prepLine.slice(0, 500),
      actionUrl: "/dashboard/denis",
    }),
  });

  await markDailyPrepBriefingSent(input.locationId, briefing.date);

  if (emailed === 0) {
    logger.warn("Daily prep briefing: no staff email recipients", {
      locationId: input.locationId,
      orgId: input.orgId,
    });
  }

  return { sent: true, skipped: false };
}

export async function runDailyPrepBriefingTick(
  admin: SupabaseClient,
  options?: { limit?: number; now?: Date }
): Promise<{
  locations: number;
  sent: number;
  skipped: number;
}> {
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
    const result = await deliverDailyPrepBriefing(admin, {
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

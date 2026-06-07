import {
  buildWeeklyNudgeDigest,
  type WeeklyNudgeDigest,
} from "@/lib/admin/build-weekly-nudge-digest";
import { loadNudgePerformanceSnapshot } from "@/lib/admin/load-nudge-performance";
import { sendEmail } from "@/lib/email/resend";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

async function loadOwnerEmails(
  admin: SupabaseClient,
  orgId: string
): Promise<string[]> {
  const { data: owners } = await admin
    .from("staff")
    .select("email")
    .eq("org_id", orgId)
    .eq("role", "owner")
    .eq("is_active", true)
    .is("deleted_at", null);

  return (owners ?? [])
    .map((row) => {
      const email = (row as { email: string | null }).email?.trim();
      return email || null;
    })
    .filter((email): email is string => Boolean(email));
}

export async function sendWeeklyNudgeDigestForLocation(
  admin: SupabaseClient,
  input: {
    locationId: string;
    orgId: string;
    periodDays?: number;
  }
): Promise<{ sent: number; skipped: boolean; digest?: WeeklyNudgeDigest }> {
  const snapshot = await loadNudgePerformanceSnapshot(admin, {
    locationId: input.locationId,
    periodDays: input.periodDays ?? 7,
  });

  if (!snapshot || snapshot.nudgeImpressions === 0) {
    return { sent: 0, skipped: true };
  }

  const recipients = await loadOwnerEmails(admin, input.orgId);
  if (recipients.length === 0) {
    logger.warn("Weekly nudge digest: no owner recipients", {
      locationId: input.locationId,
      orgId: input.orgId,
    });
    return { sent: 0, skipped: true };
  }

  const digest = buildWeeklyNudgeDigest(snapshot);
  let sent = 0;

  for (const to of recipients) {
    const result = await sendEmail({
      to,
      subject: digest.subject,
      html: digest.html,
    });
    if ("ok" in result && result.ok) sent += 1;
  }

  return { sent, skipped: false, digest };
}

export async function runWeeklyNudgeDigestTick(
  admin: SupabaseClient,
  options?: { limit?: number; periodDays?: number }
): Promise<{ locations: number; emailed: number; skipped: number }> {
  const limit = options?.limit ?? 50;

  const { data: locationRows } = await admin
    .from("locations")
    .select("id, org_id")
    .eq("ai_concierge_enabled", true)
    .limit(limit);

  const locations = (locationRows ?? []) as Array<{ id: string; org_id: string }>;
  let emailed = 0;
  let skipped = 0;

  for (const location of locations) {
    const result = await sendWeeklyNudgeDigestForLocation(admin, {
      locationId: location.id,
      orgId: location.org_id,
      periodDays: options?.periodDays ?? 7,
    });

    if (result.skipped) skipped += 1;
    else emailed += result.sent;
  }

  return { locations: locations.length, emailed, skipped };
}

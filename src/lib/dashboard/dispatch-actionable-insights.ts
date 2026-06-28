import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/resend";
import { logger } from "@/lib/logger";
import { notifyLocationPush } from "@/lib/push/notify-location";
import { loadActionableInsightsForRange } from "@/lib/dashboard/load-actionable-insights-context";
import {
  formatActionableInsightLine,
  insightDeliveryTier,
  type ActionableInsight,
  type InsightDeliveryTier,
} from "@/lib/dashboard/generate-actionable-insights";

export function partitionInsightsByDeliveryTier(
  insights: ActionableInsight[]
): Record<InsightDeliveryTier, ActionableInsight[]> {
  const buckets: Record<InsightDeliveryTier, ActionableInsight[]> = {
    critical: [],
    daily: [],
    weekly: [],
  };

  for (const insight of insights) {
    buckets[insightDeliveryTier(insight)].push(insight);
  }

  return buckets;
}

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
    .map((row) => (row as { email: string | null }).email?.trim() || null)
    .filter((email): email is string => Boolean(email));
}

async function alreadySentInsight(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    insightId: string;
    insightDate: string;
  }
): Promise<boolean> {
  const { count } = await admin
    .from("ai_insights")
    .select("id", { count: "exact", head: true })
    .eq("org_id", input.orgId)
    .eq("location_id", input.locationId)
    .eq("insight_date", input.insightDate)
    .eq("type", "actionable_alert_sent")
    .contains("metadata", { insightId: input.insightId });

  return (count ?? 0) > 0;
}

async function markInsightSent(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    insightId: string;
    insightDate: string;
    tier: InsightDeliveryTier;
  }
): Promise<void> {
  await admin.from("ai_insights").insert({
    org_id: input.orgId,
    location_id: input.locationId,
    type: "actionable_alert_sent",
    severity: input.tier === "critical" ? "critical" : "info",
    title: `Sent: ${input.insightId}`,
    detail: input.tier,
    insight_date: input.insightDate,
    is_read: true,
    metadata: { insightId: input.insightId, tier: input.tier },
  } as never);
}

/** CRITICAL insights → instant owner push (deduped per day). */
export async function sendCriticalActionableInsightPush(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    locationName: string;
    insights: ActionableInsight[];
    insightDate: string;
  }
): Promise<{ sent: number; skipped: number }> {
  const critical = partitionInsightsByDeliveryTier(input.insights).critical;
  if (critical.length === 0) return { sent: 0, skipped: 0 };

  let sent = 0;
  let skipped = 0;

  for (const insight of critical) {
    const duplicate = await alreadySentInsight(admin, {
      orgId: input.orgId,
      locationId: input.locationId,
      insightId: `${insight.id}:push`,
      insightDate: input.insightDate,
    });
    if (duplicate) {
      skipped += 1;
      continue;
    }

    const result = await notifyLocationPush(input.locationId, {
      title: `[Denis] ${insight.title}`,
      body: insight.suggestedAction,
      url: "/dashboard",
      tag: `actionable:${insight.id}`,
    });

    if (result.sent > 0) {
      sent += 1;
      await markInsightSent(admin, {
        orgId: input.orgId,
        locationId: input.locationId,
        insightId: `${insight.id}:push`,
        insightDate: input.insightDate,
        tier: "critical",
      });
    }
  }

  return { sent, skipped };
}

/** CRITICAL insights → owner email immediately (deduped per day). */
export async function sendCriticalActionableInsightAlerts(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    locationName: string;
    insights: ActionableInsight[];
    insightDate: string;
  }
): Promise<{ sent: number; skipped: number }> {
  const critical = partitionInsightsByDeliveryTier(input.insights).critical;
  if (critical.length === 0) return { sent: 0, skipped: 0 };

  const recipients = await loadOwnerEmails(admin, input.orgId);
  if (recipients.length === 0) {
    logger.warn("Actionable insights: no owner recipients", {
      locationId: input.locationId,
    });
    return { sent: 0, skipped: critical.length };
  }

  let sent = 0;
  let skipped = 0;

  for (const insight of critical) {
    const duplicate = await alreadySentInsight(admin, {
      orgId: input.orgId,
      locationId: input.locationId,
      insightId: insight.id,
      insightDate: input.insightDate,
    });
    if (duplicate) {
      skipped += 1;
      continue;
    }

    const subject = `[Denis CRITICAL] ${insight.title} — ${input.locationName}`;
    const body = [
      insight.title,
      "",
      insight.detail,
      "",
      `Preporuka: ${insight.suggestedAction}`,
      "",
      "— Denis actionable insights",
    ].join("\n");

    for (const to of recipients) {
      const result = await sendEmail({ to, subject, html: `<pre>${body}</pre>` });
      if ("ok" in result && result.ok) sent += 1;
    }

    await markInsightSent(admin, {
      orgId: input.orgId,
      locationId: input.locationId,
      insightId: insight.id,
      insightDate: input.insightDate,
      tier: "critical",
    });
  }

  return { sent, skipped };
}

export function formatActionableInsightsForDigest(
  insights: ActionableInsight[],
  tier: InsightDeliveryTier
): string[] {
  const bucket = partitionInsightsByDeliveryTier(insights)[tier];
  return bucket.map((row) => formatActionableInsightLine(row));
}

/** HIGH impact insights → one owner email per location per day (deduped). */
export async function sendDailyActionableInsightDigest(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    locationName: string;
    insights: ActionableInsight[];
    insightDate: string;
  }
): Promise<{ sent: number; skipped: boolean }> {
  const daily = partitionInsightsByDeliveryTier(input.insights).daily;
  if (daily.length === 0) return { sent: 0, skipped: true };

  const digestKey = `daily-actionable-${input.insightDate}`;
  const duplicate = await alreadySentInsight(admin, {
    orgId: input.orgId,
    locationId: input.locationId,
    insightId: digestKey,
    insightDate: input.insightDate,
  });
  if (duplicate) return { sent: 0, skipped: true };

  const recipients = await loadOwnerEmails(admin, input.orgId);
  if (recipients.length === 0) {
    return { sent: 0, skipped: true };
  }

  const subject = `[Denis] Dnevni actionable insights — ${input.locationName}`;
  const body = [
    `Denis actionable insights (${input.insightDate})`,
    "",
    ...daily.flatMap((insight) => [
      insight.title,
      insight.detail,
      `Preporuka: ${insight.suggestedAction}`,
      "",
    ]),
    "— Denis actionable insights",
  ].join("\n");

  let sent = 0;
  for (const to of recipients) {
    const result = await sendEmail({ to, subject, html: `<pre>${body}</pre>` });
    if ("ok" in result && result.ok) sent += 1;
  }

  await markInsightSent(admin, {
    orgId: input.orgId,
    locationId: input.locationId,
    insightId: digestKey,
    insightDate: input.insightDate,
    tier: "daily",
  });

  return { sent, skipped: false };
}

/** Weekly digest — medium/low insights (Sunday-style rollup). */
export async function sendWeeklyActionableInsightDigest(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    locationName: string;
    insights: ActionableInsight[];
    insightDate: string;
  }
): Promise<{ sent: number; skipped: boolean }> {
  const weekly = partitionInsightsByDeliveryTier(input.insights).weekly;
  if (weekly.length === 0) return { sent: 0, skipped: true };

  const digestKey = `weekly-actionable-${input.insightDate}`;
  const duplicate = await alreadySentInsight(admin, {
    orgId: input.orgId,
    locationId: input.locationId,
    insightId: digestKey,
    insightDate: input.insightDate,
  });
  if (duplicate) return { sent: 0, skipped: true };

  const recipients = await loadOwnerEmails(admin, input.orgId);
  if (recipients.length === 0) return { sent: 0, skipped: true };

  const subject = `[Denis] Nedeljni actionable insights — ${input.locationName}`;
  const body = [
    `Nedeljni Denis insights (${input.insightDate})`,
    "",
    ...weekly.flatMap((insight) => [
      insight.title,
      insight.detail,
      `Preporuka: ${insight.suggestedAction}`,
      "",
    ]),
    "— Denis actionable insights",
  ].join("\n");

  let sent = 0;
  for (const to of recipients) {
    const result = await sendEmail({ to, subject, html: `<pre>${body}</pre>` });
    if ("ok" in result && result.ok) sent += 1;
  }

  await markInsightSent(admin, {
    orgId: input.orgId,
    locationId: input.locationId,
    insightId: digestKey,
    insightDate: input.insightDate,
    tier: "weekly",
  });

  return { sent, skipped: false };
}

export async function dispatchActionableInsightsForLocation(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    locationName: string;
    insightDate: string;
    range?: "today" | "week";
  }
): Promise<{ criticalSent: number; dailySent: number; pushSent: number; weeklySent: number }> {
  const insights = await loadActionableInsightsForRange(admin, {
    orgId: input.orgId,
    locationId: input.locationId,
    range: input.range ?? "today",
  });

  const push = await sendCriticalActionableInsightPush(admin, {
    orgId: input.orgId,
    locationId: input.locationId,
    locationName: input.locationName,
    insights,
    insightDate: input.insightDate,
  });

  const critical = await sendCriticalActionableInsightAlerts(admin, {
    orgId: input.orgId,
    locationId: input.locationId,
    locationName: input.locationName,
    insights,
    insightDate: input.insightDate,
  });

  const daily = await sendDailyActionableInsightDigest(admin, {
    orgId: input.orgId,
    locationId: input.locationId,
    locationName: input.locationName,
    insights,
    insightDate: input.insightDate,
  });

  const weekly =
    input.range === "week"
      ? await sendWeeklyActionableInsightDigest(admin, {
          orgId: input.orgId,
          locationId: input.locationId,
          locationName: input.locationName,
          insights,
          insightDate: input.insightDate,
        })
      : { sent: 0, skipped: true };

  return {
    criticalSent: critical.sent,
    dailySent: daily.sent,
    pushSent: push.sent,
    weeklySent: weekly.sent,
  };
}

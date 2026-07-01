import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlanTierDefinition, type PlanTierId } from "@/lib/billing/tiers";

export type UsageMetricKey =
  | "denisLlmCalls"
  | "ordersProcessed"
  | "activeSessions"
  | "storageMb";

export type UsageSnapshot = {
  periodStart: string;
  periodEnd: string;
  denisLlmCalls: number;
  ordersProcessed: number;
  activeSessions: number;
  storageMb: number;
};

export type UsageLimitStatus = {
  key: UsageMetricKey;
  label: string;
  used: number;
  limit: number | null;
  percent: number | null;
  exceeded: boolean;
};

export type UsageEvaluation = {
  metrics: UsageLimitStatus[];
  anyExceeded: boolean;
  upgradeRecommended: boolean;
  exceededKeys: UsageMetricKey[];
};

function monthBounds(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function evaluateUsageAgainstLimits(
  usage: UsageSnapshot,
  planId: string | null | undefined
): UsageEvaluation {
  const tier = getPlanTierDefinition(planId);
  const { limits } = tier;

  const rows: UsageLimitStatus[] = [
    {
      key: "denisLlmCalls",
      label: "Denis LLM calls",
      used: usage.denisLlmCalls,
      limit: limits.denisLlmCallsPerMonth,
      percent: null,
      exceeded: false,
    },
    {
      key: "ordersProcessed",
      label: "Orders processed",
      used: usage.ordersProcessed,
      limit: limits.ordersPerMonth,
      percent: null,
      exceeded: false,
    },
    {
      key: "activeSessions",
      label: "Active sessions",
      used: usage.activeSessions,
      limit: null,
      percent: null,
      exceeded: false,
    },
    {
      key: "storageMb",
      label: "Storage (menu & receipts)",
      used: usage.storageMb,
      limit: limits.storageMb,
      percent: null,
      exceeded: false,
    },
  ];

  for (const row of rows) {
    if (row.limit == null || row.limit <= 0) {
      row.percent = null;
      row.exceeded = false;
      continue;
    }
    row.percent = Math.min(100, Math.round((row.used / row.limit) * 1000) / 10);
    row.exceeded = row.used > row.limit;
  }

  const exceededKeys = rows.filter((row) => row.exceeded).map((row) => row.key);

  return {
    metrics: rows,
    anyExceeded: exceededKeys.length > 0,
    upgradeRecommended: exceededKeys.length > 0,
    exceededKeys,
  };
}

export function buildUsageExceededMessage(exceededKeys: UsageMetricKey[]): string {
  if (exceededKeys.includes("denisLlmCalls")) {
    return "Denis AI monthly limit reached. Upgrade to Pro for more turns.";
  }
  if (exceededKeys.includes("storageMb")) {
    return "Storage limit reached. Upgrade for more menu image & receipt space.";
  }
  return "Plan usage limit reached. Upgrade to continue without interruption.";
}

export function buildUsageExceededNotification(exceededKeys: UsageMetricKey[]) {
  return {
    title: "Plan limit reached",
    body: buildUsageExceededMessage(exceededKeys),
    url: "/dashboard/billing",
  };
}

function estimateStorageMb(input: {
  productImages: number;
  orgLogo: boolean;
  orgCover: boolean;
  receiptCount: number;
}): number {
  const avgProductImageMb = 0.35;
  const avgReceiptMb = 0.05;
  const brandingMb = (input.orgLogo ? 0.5 : 0) + (input.orgCover ? 1 : 0);
  return (
    Math.round(
      (input.productImages * avgProductImageMb +
        input.receiptCount * avgReceiptMb +
        brandingMb) *
        10
    ) / 10
  );
}

export async function loadOrgUsageSnapshot(
  admin: SupabaseClient,
  orgId: string,
  locationIds: string[]
): Promise<UsageSnapshot> {
  const { start, end } = monthBounds();

  const monthStartDate = start.slice(0, 10);

  const [
    { data: experienceRows },
    { count: orderCount },
    { count: sessionCount },
    { data: products },
    { data: org },
    { count: receiptCount },
  ] = await Promise.all([
    admin
      .from("experience_analytics_daily")
      .select("llm_turns, metric_date")
      .eq("org_id", orgId)
      .gte("metric_date", monthStartDate),
    locationIds.length
      ? admin
          .from("orders")
          .select("id", { count: "exact", head: true })
          .in("location_id", locationIds)
          .gte("created_at", start)
          .lte("created_at", end)
          .neq("status", "cancelled")
      : Promise.resolve({ count: 0 }),
    locationIds.length
      ? admin
          .from("table_sessions")
          .select("id", { count: "exact", head: true })
          .in("location_id", locationIds)
          .gte("opened_at", start)
          .lte("opened_at", end)
      : Promise.resolve({ count: 0 }),
    locationIds.length
      ? admin
          .from("products")
          .select("image_url")
          .in("location_id", locationIds)
          .not("image_url", "is", null)
      : Promise.resolve({ data: [] }),
    admin
      .from("organizations")
      .select("logo_url, cover_image_url")
      .eq("id", orgId)
      .maybeSingle(),
    locationIds.length
      ? admin
          .from("orders")
          .select("id", { count: "exact", head: true })
          .in("location_id", locationIds)
          .not("receipt_sent_at", "is", null)
          .gte("created_at", start)
          .lte("created_at", end)
      : Promise.resolve({ count: 0 }),
  ]);

  let denisLlmCalls = 0;
  for (const row of experienceRows ?? []) {
    denisLlmCalls += (row as { llm_turns: number }).llm_turns;
  }

  const orgRow = org as { logo_url: string | null; cover_image_url: string | null } | null;
  const productImages = (products ?? []).length;

  return {
    periodStart: start,
    periodEnd: end,
    denisLlmCalls,
    ordersProcessed: orderCount ?? 0,
    activeSessions: sessionCount ?? 0,
    storageMb: estimateStorageMb({
      productImages,
      orgLogo: Boolean(orgRow?.logo_url),
      orgCover: Boolean(orgRow?.cover_image_url),
      receiptCount: receiptCount ?? 0,
    }),
  };
}

export function nextTierForUpgrade(planId: string | null | undefined): PlanTierId | null {
  const tier = getPlanTierDefinition(planId).id;
  if (tier === "starter") return "business";
  if (tier === "business") return "enterprise";
  return null;
}

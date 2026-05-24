import { createAdminClient } from "@/lib/supabase/admin";
import type { RevenueSeriesPoint } from "@/lib/analytics/admin-analytics";

export type OrgTrialStatus = "active" | "trial" | "expired" | "setup";

export type OrgComplianceStatus = "compliant" | "partial" | "critical";

export type PlatformOrgRow = {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  currency: string;
  stripe_onboarded: boolean;
  onboarding_completed: boolean;
  trial_ends_at: string | null;
  created_at: string;
  fiskaly_tss_id: string | null;
  steuernummer: string | null;
  location_count: number;
  order_count: number;
  revenue: number;
  trial_status: OrgTrialStatus;
};

export function orgComplianceStatus(org: {
  fiskaly_tss_id: string | null;
  steuernummer: string | null;
  stripe_onboarded: boolean;
}): OrgComplianceStatus {
  if (!org.fiskaly_tss_id) return "critical";
  const hasSteuer = Boolean(org.steuernummer?.trim());
  if (hasSteuer && org.stripe_onboarded) return "compliant";
  return "partial";
}

function orgTrialStatus(org: {
  onboarding_completed: boolean;
  trial_ends_at: string | null;
}): OrgTrialStatus {
  if (!org.onboarding_completed) return "setup";
  if (!org.trial_ends_at) return "active";
  const ends = new Date(org.trial_ends_at).getTime();
  if (ends > Date.now()) return "trial";
  return "expired";
}

export async function loadPlatformOverview() {
  const admin = createAdminClient();
  const since30 = new Date();
  since30.setDate(since30.getDate() - 30);

  const [{ data: orgs }, { data: orders }] = await Promise.all([
    admin
      .from("organizations")
      .select(
        "id, created_at, onboarding_completed, trial_ends_at, fiskaly_tss_id, steuernummer"
      )
      .order("created_at", { ascending: true }),
    admin
      .from("orders")
      .select("total, payment_status, created_at")
      .eq("payment_status", "paid")
      .gte("created_at", since30.toISOString()),
  ]);

  const orgRows = orgs ?? [];
  const now = Date.now();
  let activeOrgs = 0;
  let trialOrgs = 0;
  let tseActiveOrgs = 0;
  let missingSteuernummer = 0;

  for (const org of orgRows) {
    const row = org as {
      onboarding_completed: boolean;
      trial_ends_at: string | null;
      fiskaly_tss_id: string | null;
      steuernummer: string | null;
    };
    if (row.fiskaly_tss_id) tseActiveOrgs += 1;
    if (!row.onboarding_completed) continue;
    const inTrial =
      row.trial_ends_at && new Date(row.trial_ends_at).getTime() > now;
    if (inTrial) {
      trialOrgs += 1;
    } else {
      activeOrgs += 1;
      if (!row.steuernummer?.trim()) missingSteuernummer += 1;
    }
  }

  const paidOrders = (orders ?? []) as Array<{ total: number; created_at: string }>;
  const revenue30 = paidOrders.reduce((sum, o) => sum + Number(o.total), 0);

  const signupMap = new Map<string, number>();
  for (const org of orgRows) {
    const day = (org as { created_at: string }).created_at.slice(0, 10);
    signupMap.set(day, (signupMap.get(day) ?? 0) + 1);
  }

  const signupsSeries: RevenueSeriesPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    signupsSeries.push({
      label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      revenue: signupMap.get(key) ?? 0,
    });
  }

  return {
    totalOrgs: orgRows.length,
    activeOrgs,
    trialOrgs,
    tseActiveOrgs,
    missingSteuernummer,
    revenue30,
    signupsSeries,
  };
}

export async function loadPlatformOrgs(filter?: OrgTrialStatus, search?: string) {
  const admin = createAdminClient();

  const [{ data: orgs }, { data: locations }, { data: orders }] = await Promise.all([
    admin
      .from("organizations")
      .select(
        "id, name, slug, email, currency, stripe_onboarded, onboarding_completed, trial_ends_at, created_at, fiskaly_tss_id, steuernummer"
      )
      .order("created_at", { ascending: false }),
    admin.from("locations").select("id, org_id").eq("is_active", true),
    admin
      .from("orders")
      .select("id, total, payment_status, location_id")
      .eq("payment_status", "paid"),
  ]);

  const locByOrg = new Map<string, number>();
  for (const loc of locations ?? []) {
    const orgId = (loc as { org_id: string }).org_id;
    locByOrg.set(orgId, (locByOrg.get(orgId) ?? 0) + 1);
  }

  const locToOrg = new Map<string, string>();
  for (const loc of locations ?? []) {
    locToOrg.set(
      (loc as { id: string }).id,
      (loc as { org_id: string }).org_id
    );
  }

  const statsByOrg = new Map<string, { orders: number; revenue: number }>();
  for (const order of orders ?? []) {
    const row = order as { location_id: string; total: number };
    const orgId = locToOrg.get(row.location_id);
    if (!orgId) continue;
    const cur = statsByOrg.get(orgId) ?? { orders: 0, revenue: 0 };
    cur.orders += 1;
    cur.revenue += Number(row.total);
    statsByOrg.set(orgId, cur);
  }

  let rows: PlatformOrgRow[] = (orgs ?? []).map((org) => {
    const o = org as PlatformOrgRow;
    const stats = statsByOrg.get(o.id) ?? { orders: 0, revenue: 0 };
    return {
      ...o,
      fiskaly_tss_id: o.fiskaly_tss_id ?? null,
      steuernummer: o.steuernummer ?? null,
      location_count: locByOrg.get(o.id) ?? 0,
      order_count: stats.orders,
      revenue: stats.revenue,
      trial_status: orgTrialStatus(o),
    };
  });

  if (filter) {
    rows = rows.filter((r) => r.trial_status === filter);
  }

  const q = search?.trim().toLowerCase();
  if (q) {
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q) ||
        (r.email?.toLowerCase().includes(q) ?? false)
    );
  }

  return rows;
}

export async function loadPlatformOrgDetail(orgId: string) {
  const admin = createAdminClient();

  const [{ data: org }, { data: owner }, { data: locations }, { data: staffCount }] =
    await Promise.all([
      admin
        .from("organizations")
        .select("*")
        .eq("id", orgId)
        .maybeSingle(),
      admin
        .from("staff")
        .select("id, name, email, user_id")
        .eq("org_id", orgId)
        .eq("role", "owner")
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle(),
      admin
        .from("locations")
        .select("id")
        .eq("org_id", orgId)
        .eq("is_active", true),
      admin
        .from("staff")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .is("deleted_at", null),
    ]);

  if (!org) return null;

  const locationIds = ((locations ?? []) as Array<{ id: string }>).map((l) => l.id);
  let orderCount = 0;
  let revenue = 0;
  let posIntegrations: Array<{
    provider: string;
    status: string;
    external_location_id: string | null;
  }> = [];
  let printers: Array<{
    id: string;
    name: string;
    type: string;
    auto_print: boolean;
    pending_jobs: number;
  }> = [];
  let pendingPrintJobs = 0;

  if (locationIds.length) {
    const [{ data: orders }, { data: posRows }, { data: printerRows }, { count: pendingCount }] =
      await Promise.all([
        admin
          .from("orders")
          .select("total, payment_status")
          .in("location_id", locationIds)
          .eq("payment_status", "paid"),
        admin
          .from("pos_integrations")
          .select("provider, status, external_location_id")
          .in("location_id", locationIds),
        admin
          .from("printer_configs")
          .select("id, name, type, auto_print")
          .in("location_id", locationIds),
        admin
          .from("print_jobs")
          .select("id", { count: "exact", head: true })
          .in("location_id", locationIds)
          .eq("status", "pending"),
      ]);

    orderCount = orders?.length ?? 0;
    revenue = (orders ?? []).reduce(
      (sum, o) => sum + Number((o as { total: number }).total),
      0
    );

    posIntegrations = (posRows ?? []) as typeof posIntegrations;
    pendingPrintJobs = pendingCount ?? 0;

    const printerIds = ((printerRows ?? []) as Array<{ id: string }>).map((p) => p.id);
    const pendingByPrinter = new Map<string, number>();

    if (printerIds.length) {
      const { data: pendingJobs } = await admin
        .from("print_jobs")
        .select("printer_id")
        .in("printer_id", printerIds)
        .eq("status", "pending");

      for (const job of pendingJobs ?? []) {
        const printerId = (job as { printer_id: string }).printer_id;
        pendingByPrinter.set(printerId, (pendingByPrinter.get(printerId) ?? 0) + 1);
      }
    }

    printers = ((printerRows ?? []) as Array<{
      id: string;
      name: string;
      type: string;
      auto_print: boolean;
    }>).map((p) => ({
      ...p,
      pending_jobs: pendingByPrinter.get(p.id) ?? 0,
    }));
  }

  return {
    org,
    owner: owner as { id: string; name: string; email: string | null; user_id: string } | null,
    locationCount: locationIds.length,
    staffCount: staffCount ?? 0,
    orderCount,
    revenue,
    trial_status: orgTrialStatus(org as { onboarding_completed: boolean; trial_ends_at: string | null }),
    posIntegrations,
    printers,
    pendingPrintJobs,
  };
}

export async function loadPlatformAnalytics() {
  const admin = createAdminClient();
  const since30 = new Date();
  since30.setDate(since30.getDate() - 30);

  const [{ data: orders }, { data: orgs }] = await Promise.all([
    admin
      .from("orders")
      .select("total, payment_status, created_at, location_id")
      .eq("payment_status", "paid")
      .gte("created_at", since30.toISOString()),
    admin.from("organizations").select("id, created_at"),
  ]);

  const revenueByDay = new Map<string, number>();
  const ordersByDay = new Map<string, number>();

  for (const order of orders ?? []) {
    const row = order as { total: number; created_at: string };
    const day = row.created_at.slice(0, 10);
    revenueByDay.set(day, (revenueByDay.get(day) ?? 0) + Number(row.total));
    ordersByDay.set(day, (ordersByDay.get(day) ?? 0) + 1);
  }

  const revenueSeries: RevenueSeriesPoint[] = [];
  const ordersSeries: RevenueSeriesPoint[] = [];

  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    revenueSeries.push({ label, revenue: revenueByDay.get(key) ?? 0 });
    ordersSeries.push({ label, revenue: ordersByDay.get(key) ?? 0 });
  }

  const orgIdsWithOrders = new Set<string>();
  const { data: locations } = await admin.from("locations").select("id, org_id");
  const locToOrg = new Map(
    ((locations ?? []) as Array<{ id: string; org_id: string }>).map((l) => [
      l.id,
      l.org_id,
    ])
  );

  for (const order of orders ?? []) {
    const orgId = locToOrg.get((order as { location_id: string }).location_id);
    if (orgId) orgIdsWithOrders.add(orgId);
  }

  const totalOrgs = orgs?.length ?? 0;
  const churned = totalOrgs - orgIdsWithOrders.size;

  return {
    revenueSeries,
    ordersSeries,
    totalRevenue: revenueSeries.reduce((s, p) => s + p.revenue, 0),
    totalOrders: ordersSeries.reduce((s, p) => s + p.revenue, 0),
    churned,
    activeOrgs: orgIdsWithOrders.size,
  };
}

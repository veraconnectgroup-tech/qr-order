import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export async function notifyNewOrgGoingLive(
  orgId: string,
  locationId: string
): Promise<void> {
  const admin = createAdminClient();

  const [
    { data: org },
    { count: productCount },
    { count: categoryCount },
    { count: tableCount },
  ] = await Promise.all([
    admin
      .from("organizations")
      .select(
        "name, email, stripe_onboarded, fiskaly_tss_id, steuernummer, trial_ends_at"
      )
      .eq("id", orgId)
      .maybeSingle(),
    admin
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("location_id", locationId)
      .is("deleted_at", null),
    admin
      .from("categories")
      .select("id", { count: "exact", head: true })
      .eq("location_id", locationId)
      .is("deleted_at", null),
    admin
      .from("tables")
      .select("id", { count: "exact", head: true })
      .eq("location_id", locationId)
      .is("deleted_at", null),
  ]);

  const orgRow = org as {
    name: string;
    email: string | null;
    stripe_onboarded: boolean;
    fiskaly_tss_id: string | null;
    steuernummer: string | null;
    trial_ends_at: string | null;
  } | null;

  logger.info("Platform: new org went live", {
    orgId,
    locationId,
    orgName: orgRow?.name ?? "unknown",
    email: orgRow?.email ?? null,
    plan: orgRow?.trial_ends_at ? "trial" : "live",
    tseActive: Boolean(orgRow?.fiskaly_tss_id),
    steuernummerSet: Boolean(orgRow?.steuernummer?.trim()),
    stripeOnboarded: orgRow?.stripe_onboarded ?? false,
    productCount: productCount ?? 0,
    categoryCount: categoryCount ?? 0,
    tableCount: tableCount ?? 0,
  });
}

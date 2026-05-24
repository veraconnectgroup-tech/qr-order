import type { ResolvedContext } from "@/lib/orders/create/types";
import { err, ok, type OrderCreateError, type Result } from "@/lib/orders/create/result";
import { orderError } from "@/lib/orders/create/pipeline/errors";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export async function resolveOrderContext(
  admin: AdminClient,
  tableToken: string
): Promise<Result<ResolvedContext, OrderCreateError>> {
  const { data: table, error: tableError } = await admin
    .from("tables")
    .select("id, name, location_id, zone_id, assigned_staff_id")
    .eq("qr_token", tableToken)
    .eq("is_active", true)
    .is("deleted_at", null)
    .single();

  if (tableError || !table) {
    return err(orderError("invalid_qr", "Invalid QR code", 404));
  }

  const tableRow = table as ResolvedContext["table"];

  const { data: location, error: locationError } = await admin
    .from("locations")
    .select(
      "id, org_id, accepting_orders, ordering_enabled, payment_online_enabled, payment_at_bar_enabled, payment_card_at_table_enabled"
    )
    .eq("id", tableRow.location_id)
    .single();

  if (locationError || !location) {
    return err(orderError("invalid_qr", "Location not found", 404));
  }

  const locationRow = location as ResolvedContext["location"];

  if (!locationRow.ordering_enabled) {
    return err(
      orderError(
        "ordering_paused",
        "Online ordering is not available.",
        403
      )
    );
  }

  if (!locationRow.accepting_orders) {
    return err(
      orderError(
        "ordering_paused",
        "Ordering is temporarily paused.",
        403
      )
    );
  }

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select(
      "id, default_tax_percent, currency, stripe_account_id, stripe_onboarded"
    )
    .eq("id", locationRow.org_id)
    .single();

  if (orgError || !org) {
    return err(orderError("invalid_qr", "Organization not found", 404));
  }

  return ok({
    table: tableRow,
    location: locationRow,
    org: org as ResolvedContext["org"],
  });
}

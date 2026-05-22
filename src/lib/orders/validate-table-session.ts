import { SESSION_MAX_AGE_HOURS } from "@/lib/constants";
import type { SupabaseClient } from "@supabase/supabase-js";

type AdminClient = SupabaseClient;

export type ValidatedTableSession = {
  table: {
    id: string;
    name: string;
    location_id: string;
    zone_id: string | null;
  };
  session: {
    id: string;
    session_token: string;
    table_id: string;
    location_id: string;
  };
  location: {
    id: string;
    org_id: string;
    accepting_orders: boolean;
    payment_online_enabled: boolean;
    payment_at_bar_enabled: boolean;
    payment_card_at_table_enabled: boolean;
  };
  org: {
    id: string;
    default_tax_percent: number;
    currency: string;
    stripe_account_id: string | null;
    stripe_onboarded: boolean;
  };
};

export async function validateTableSession(
  admin: AdminClient,
  tableToken: string,
  sessionToken: string
): Promise<{ data: ValidatedTableSession } | { error: string; status: number }> {
  const { data: table } = await admin
    .from("tables")
    .select("id, name, location_id, zone_id")
    .eq("qr_token", tableToken)
    .eq("is_active", true)
    .single();

  if (!table) {
    return { error: "Invalid QR code", status: 404 };
  }

  const tableRow = table as ValidatedTableSession["table"];

  const { data: location } = await admin
    .from("locations")
    .select(
      "id, org_id, accepting_orders, payment_online_enabled, payment_at_bar_enabled, payment_card_at_table_enabled"
    )
    .eq("id", tableRow.location_id)
    .single();

  if (!location) {
    return { error: "Location not found", status: 404 };
  }

  const locationRow = location as ValidatedTableSession["location"];

  if (!locationRow.accepting_orders) {
    return { error: "Ordering is temporarily paused.", status: 403 };
  }

  const { data: org } = await admin
    .from("organizations")
    .select(
      "id, default_tax_percent, currency, stripe_account_id, stripe_onboarded"
    )
    .eq("id", locationRow.org_id)
    .single();

  if (!org) {
    return { error: "Organization not found", status: 404 };
  }

  const maxAgeMs = SESSION_MAX_AGE_HOURS * 60 * 60 * 1000;
  const sessionCutoff = new Date(Date.now() - maxAgeMs).toISOString();

  const { data: session } = await admin
    .from("table_sessions")
    .select("id, session_token, table_id, location_id, opened_at, status")
    .eq("session_token", sessionToken)
    .eq("status", "active")
    .gte("opened_at", sessionCutoff)
    .maybeSingle();

  if (!session) {
    return { error: "Session expired or invalid", status: 400 };
  }

  const sessionRow = session as ValidatedTableSession["session"] & {
    opened_at: string;
  };

  if (sessionRow.table_id !== tableRow.id) {
    return { error: "Session does not match this table", status: 403 };
  }

  if (sessionRow.location_id !== tableRow.location_id) {
    return { error: "Session location mismatch", status: 403 };
  }

  return {
    data: {
      table: tableRow,
      session: sessionRow,
      location: locationRow,
      org: org as ValidatedTableSession["org"],
    },
  };
}

export async function verifyOrderSessionAccess(
  admin: AdminClient,
  orderId: string,
  sessionToken: string
): Promise<boolean> {
  const { data: order } = await admin
    .from("orders")
    .select("session_id")
    .eq("id", orderId)
    .single();

  if (!order) return false;

  const orderRow = order as { session_id: string | null };
  if (!orderRow.session_id) return false;

  const { data: session } = await admin
    .from("table_sessions")
    .select("session_token")
    .eq("id", orderRow.session_id)
    .single();

  return (
    !!session &&
    (session as { session_token: string }).session_token === sessionToken
  );
}

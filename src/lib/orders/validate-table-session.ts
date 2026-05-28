import type { SupabaseClient } from "@supabase/supabase-js";

type AdminClient = SupabaseClient;

export type ValidatedTableSession = {
  table: {
    id: string;
    name: string;
    location_id: string;
    zone_id: string | null;
    assigned_staff_id: string | null;
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
    ordering_enabled: boolean;
    payment_online_enabled: boolean;
    payment_at_bar_enabled: boolean;
    payment_card_at_table_enabled: boolean;
    require_first_table_approval: boolean;
  };
  org: {
    id: string;
    default_tax_percent: number;
    currency: string;
    stripe_account_id: string | null;
    stripe_onboarded: boolean;
  };
};

export async function resolveTableForOrdering(
  admin: AdminClient,
  tableToken: string
): Promise<{ data: ValidatedTableSession } | { error: string; status: number }> {
  const { data: table } = await admin
    .from("tables")
    .select("id, name, location_id, zone_id, assigned_staff_id")
    .eq("qr_token", tableToken)
    .eq("is_active", true)
    .is("deleted_at", null)
    .single();

  if (!table) {
    return { error: "Invalid QR code", status: 404 };
  }

  const tableRow = table as ValidatedTableSession["table"];

  const { data: location } = await admin
    .from("locations")
    .select(
      "id, org_id, accepting_orders, ordering_enabled, payment_online_enabled, payment_at_bar_enabled, payment_card_at_table_enabled, require_first_table_approval"
    )
    .eq("id", tableRow.location_id)
    .single();

  if (!location) {
    return { error: "Location not found", status: 404 };
  }

  const locationRow = {
    ...(location as Omit<
      ValidatedTableSession["location"],
      "require_first_table_approval"
    >),
    require_first_table_approval:
      (location as { require_first_table_approval?: boolean })
        .require_first_table_approval ?? true,
  } satisfies ValidatedTableSession["location"];

  if (!locationRow.ordering_enabled) {
    return { error: "Online ordering is not available.", status: 403 };
  }

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

  return {
    data: {
      table: tableRow,
      session: {
        id: "",
        session_token: "",
        table_id: tableRow.id,
        location_id: tableRow.location_id,
      },
      location: locationRow,
      org: org as ValidatedTableSession["org"],
    },
  };
}

export async function validateTableSession(
  admin: AdminClient,
  tableToken: string,
  sessionToken: string
): Promise<{ data: ValidatedTableSession } | { error: string; status: number }> {
  const { data: table } = await admin
    .from("tables")
    .select("id, name, location_id, zone_id, assigned_staff_id")
    .eq("qr_token", tableToken)
    .eq("is_active", true)
    .is("deleted_at", null)
    .single();

  if (!table) {
    return { error: "Invalid QR code", status: 404 };
  }

  const tableRow = table as ValidatedTableSession["table"];

  const { data: location } = await admin
    .from("locations")
    .select(
      "id, org_id, accepting_orders, ordering_enabled, payment_online_enabled, payment_at_bar_enabled, payment_card_at_table_enabled, require_first_table_approval"
    )
    .eq("id", tableRow.location_id)
    .single();

  if (!location) {
    return { error: "Location not found", status: 404 };
  }

  const locationRow = {
    ...(location as Omit<
      ValidatedTableSession["location"],
      "require_first_table_approval"
    >),
    require_first_table_approval:
      (location as { require_first_table_approval?: boolean })
        .require_first_table_approval ?? true,
  } satisfies ValidatedTableSession["location"];

  if (!locationRow.ordering_enabled) {
    return { error: "Online ordering is not available.", status: 403 };
  }

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

  const { data: session } = await admin
    .from("table_sessions")
    .select(
      "id, session_token, table_id, location_id, opened_at, status, bill_status, access_state"
    )
    .eq("session_token", sessionToken)
    .eq("status", "active")
    .eq("bill_status", "open")
    .maybeSingle();

  if (!session) {
    return { error: "Session expired or invalid", status: 400 };
  }

  const sessionRow = session as ValidatedTableSession["session"] & {
    opened_at: string;
    access_state: string;
  };

  if (
    sessionRow.access_state === "closing" ||
    sessionRow.access_state === "closed"
  ) {
    return {
      error: "This table session is closing. Payment is not available.",
      status: 409,
    };
  }

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

export async function verifyTableOrderAccess(
  admin: AdminClient,
  orderId: string,
  tableToken: string,
  sessionToken: string
): Promise<
  | {
      order: {
        id: string;
        table_id: string | null;
        location_id: string;
        total: number;
        subtotal: number;
        tip_amount: number;
        payment_status: string;
        is_split: boolean;
        stripe_payment_intent_id: string | null;
      };
      session: { id: string };
      org: ValidatedTableSession["org"] & {
        platform_fee_percent: number;
        platform_fee_fixed: number;
      };
    }
  | { error: string; status: number }
> {
  const sessionResult = await validateTableSession(
    admin,
    tableToken,
    sessionToken
  );
  if ("error" in sessionResult) {
    return sessionResult;
  }

  const { table, session, org } = sessionResult.data;

  const { data: order } = await admin
    .from("orders")
    .select(
      "id, table_id, location_id, subtotal, total, tip_amount, payment_status, is_split, stripe_payment_intent_id"
    )
    .eq("id", orderId)
    .single();

  if (!order) {
    return { error: "Order not found.", status: 404 };
  }

  const orderRow = order as {
    id: string;
    table_id: string | null;
    location_id: string;
    subtotal: number;
    total: number;
    tip_amount: number;
    payment_status: string;
    is_split: boolean;
    stripe_payment_intent_id: string | null;
  };

  if (orderRow.table_id !== table.id) {
    return { error: "Order is not for this table.", status: 403 };
  }

  if (orderRow.location_id !== table.location_id) {
    return { error: "Order location mismatch.", status: 403 };
  }

  const { data: orgFees } = await admin
    .from("organizations")
    .select("platform_fee_percent, platform_fee_fixed")
    .eq("id", org.id)
    .single();

  const fees = orgFees as {
    platform_fee_percent: number;
    platform_fee_fixed: number;
  } | null;

  return {
    order: orderRow,
    session: { id: session.id },
    org: {
      ...org,
      platform_fee_percent: fees?.platform_fee_percent ?? 0,
      platform_fee_fixed: fees?.platform_fee_fixed ?? 0,
    },
  };
}

import type { createAdminClient } from "@/lib/supabase/admin";

const MIN_KEY_LENGTH = 8;
const MAX_KEY_LENGTH = 128;

export function parseIdempotencyKey(
  header: string | null | undefined
): string | null {
  if (!header) return null;
  const key = header.trim();
  if (key.length < MIN_KEY_LENGTH || key.length > MAX_KEY_LENGTH) {
    return null;
  }
  if (!/^[\x21-\x7E]+$/.test(key)) {
    return null;
  }
  return key;
}

export type IdempotentOrderData = {
  orderId: string;
  orderNumber: number;
  total: number;
  taxPercent: number;
  tableName: string;
  currency: string;
  orgId: string;
  locationId: string;
  awaitingApproval?: true;
};

export async function findOrderByIdempotencyKey(
  admin: ReturnType<typeof createAdminClient>,
  idempotencyKey: string
): Promise<IdempotentOrderData | null> {
  const { data: order } = await admin
    .from("orders")
    .select(
      "id, order_number, total, tax_percent, status, location_id, table_id, requires_session_open"
    )
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (!order) return null;

  const row = order as {
    id: string;
    order_number: number;
    total: number;
    tax_percent: number;
    status: string;
    location_id: string;
    table_id: string | null;
    requires_session_open: boolean;
  };

  const { data: location } = await admin
    .from("locations")
    .select("org_id")
    .eq("id", row.location_id)
    .single();

  if (!location) return null;

  const { data: org } = await admin
    .from("organizations")
    .select("currency")
    .eq("id", (location as { org_id: string }).org_id)
    .single();

  let tableName = "Table";
  if (row.table_id) {
    const { data: table } = await admin
      .from("tables")
      .select("name")
      .eq("id", row.table_id)
      .maybeSingle();
    tableName = (table as { name: string } | null)?.name ?? tableName;
  }

  const result: IdempotentOrderData = {
    orderId: row.id,
    orderNumber: row.order_number,
    total: row.total,
    taxPercent: row.tax_percent,
    tableName,
    currency: (org as { currency: string } | null)?.currency ?? "EUR",
    orgId: (location as { org_id: string }).org_id,
    locationId: row.location_id,
  };

  if (row.status === "pending_approval" && row.requires_session_open) {
    result.awaitingApproval = true;
  }

  return result;
}

export function isIdempotencyUniqueViolation(error: {
  code?: string;
  message?: string;
} | null): boolean {
  if (!error) return false;
  return error.code === "23505" && error.message.includes("idempotency");
}

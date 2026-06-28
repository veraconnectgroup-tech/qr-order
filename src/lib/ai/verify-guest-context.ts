import type { SupabaseClient } from "@supabase/supabase-js";
import { SESSION_MAX_AGE_HOURS } from "@/lib/constants";
import { parseMenuLocaleFromDb } from "@/lib/i18n/detect-locale";
import type { MenuLocale } from "@/lib/i18n/translations";
import { hasFeature } from "@/lib/platform/feature-flags";
import { parseAiGuestLocationRow } from "@/lib/supabase/parse-location-rows";

export type AiGuestContext = {
  orgId: string;
  orgName: string;
  locationId: string;
  tableId: string;
  tableSessionToken: string;
  menuLocale: MenuLocale;
};

export async function verifyAiGuestContext(
  admin: SupabaseClient,
  input: {
    locationId: string;
    tableId: string;
    sessionToken: string;
  }
): Promise<
  { data: AiGuestContext } | { error: string; status: number }
> {
  const { data: location, error: locationError } = await admin
    .from("locations")
    .select(
      "id, org_id, ai_concierge_enabled, organization:organizations(id, name, feature_flags)"
    )
    .eq("id", input.locationId)
    .single();

  if (locationError || !location) {
    return { error: "Location not found.", status: 404 };
  }

  const row = parseAiGuestLocationRow(location);

  if (
    !row.ai_concierge_enabled ||
    !hasFeature(
      { feature_flags: row.organization?.feature_flags as import("@/types/database").Json },
      "ai_concierge"
    )
  ) {
    return { error: "Denis is not enabled for this location.", status: 403 };
  }

  const { data: table, error: tableError } = await admin
    .from("tables")
    .select("id, location_id, qr_token")
    .eq("id", input.tableId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .single();

  if (tableError || !table) {
    return { error: "Table not found.", status: 404 };
  }

  const tableRow = table as { id: string; location_id: string; qr_token: string };
  if (tableRow.location_id !== row.id) {
    return { error: "Table does not belong to this location.", status: 403 };
  }

  const guestContext: AiGuestContext = {
    orgId: row.org_id,
    orgName: row.organization?.name ?? "Restaurant",
    locationId: row.id,
    tableId: tableRow.id,
    tableSessionToken: input.sessionToken,
    menuLocale: parseMenuLocaleFromDb(row.menu_locale, row.default_locale),
  };

  // QR token is always valid for this table (browse + seated).
  if (tableRow.qr_token === input.sessionToken) {
    return { data: guestContext };
  }

  const maxAgeMs = SESSION_MAX_AGE_HOURS * 60 * 60 * 1000;
  const sessionCutoff = new Date(Date.now() - maxAgeMs).toISOString();

  const { data: tableSession } = await admin
    .from("table_sessions")
    .select("id, session_token, table_id, location_id, status, opened_at")
    .eq("session_token", input.sessionToken)
    .eq("status", "active")
    .gte("opened_at", sessionCutoff)
    .maybeSingle();

  if (tableSession) {
    const sessionRow = tableSession as {
      table_id: string;
      location_id: string;
    };

    if (sessionRow.table_id !== input.tableId) {
      return { error: "Session does not match this table.", status: 403 };
    }

    if (sessionRow.location_id !== input.locationId) {
      return { error: "Session location mismatch.", status: 403 };
    }

    return { data: guestContext };
  }

  return { error: "Session expired or invalid.", status: 401 };
}

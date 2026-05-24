import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getActiveTableSession,
  isTrustedDevice,
  trustSessionDevice,
} from "@/lib/sessions/session-devices";
import { verifyTablePin } from "@/lib/sessions/table-pin";
import { validateTableSession } from "@/lib/orders/validate-table-session";

type AdminClient = SupabaseClient;

export async function assertGuestCanPlaceOrder(
  admin: AdminClient,
  input: {
    tableToken: string;
    sessionToken?: string;
    deviceFingerprint: string;
    deviceToken?: string;
    tablePin?: string;
  }
): Promise<
  | { ok: true; trusted: boolean }
  | { ok: false; error: string; status: number }
> {
  const { data: table } = await admin
    .from("tables")
    .select("id")
    .eq("qr_token", input.tableToken)
    .eq("is_active", true)
    .is("deleted_at", null)
    .single();

  if (!table) {
    return { ok: false, error: "Invalid QR code", status: 404 };
  }

  const tableId = (table as { id: string }).id;
  const activeSession = await getActiveTableSession(admin, tableId);

  if (!activeSession) {
    return { ok: false, error: "no_active_session", status: 403 };
  }

  if (!input.sessionToken) {
    return { ok: false, error: "Session required.", status: 401 };
  }

  const sessionResult = await validateTableSession(
    admin,
    input.tableToken,
    input.sessionToken
  );

  if ("error" in sessionResult) {
    return { ok: false, error: sessionResult.error, status: sessionResult.status };
  }

  if (input.deviceToken) {
    const trusted = await isTrustedDevice(admin, {
      sessionId: activeSession.id,
      deviceToken: input.deviceToken,
      deviceFingerprint: input.deviceFingerprint,
    });
    if (trusted) {
      return { ok: true, trusted: true };
    }
  }

  if (input.tablePin && activeSession.order_pin_hash) {
    if (!verifyTablePin(input.tablePin, activeSession.order_pin_hash)) {
      return { ok: false, error: "invalid_pin", status: 403 };
    }

    await trustSessionDevice(admin, {
      sessionId: activeSession.id,
      deviceFingerprint: input.deviceFingerprint,
    });

    return { ok: true, trusted: false };
  }

  return { ok: false, error: "pin_required", status: 403 };
}

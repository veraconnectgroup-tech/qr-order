import type { SupabaseClient } from "@supabase/supabase-js";
import { validateTableSession } from "@/lib/orders/validate-table-session";
import {
  getActiveTableSession,
  isTrustedDevice,
  trustSessionDevice,
} from "@/lib/sessions/session-devices";

export type EnsureTrustedDeviceOk = {
  /** Real table-session token to submit with (undefined → pipeline opens a session). */
  sessionToken?: string;
  deviceToken?: string;
};

/**
 * Trust party device for Denis ACL submit (server-side, no guest PIN sheet).
 *
 * The QR token is never a table-session token — when the client has no real
 * session token we resolve the table's active session directly (QR presence
 * is the access proof, same as waiter calls), or let the order create
 * pipeline open a fresh session when none exists.
 */
export async function ensureTrustedDeviceForDenisSubmit(
  admin: SupabaseClient,
  input: {
    tableToken: string;
    sessionToken?: string;
    deviceFingerprint: string;
    deviceToken?: string;
  }
): Promise<EnsureTrustedDeviceOk | { error: string }> {
  const provided = input.sessionToken?.trim();
  const candidateToken =
    provided && provided !== input.tableToken ? provided : null;

  if (candidateToken) {
    const sessionResult = await validateTableSession(
      admin,
      input.tableToken,
      candidateToken
    );

    if (!("error" in sessionResult)) {
      const sessionId = sessionResult.data.session.id;

      if (input.deviceToken) {
        const trusted = await isTrustedDevice(admin, {
          sessionId,
          deviceToken: input.deviceToken,
          deviceFingerprint: input.deviceFingerprint,
        });
        if (trusted) {
          return { sessionToken: candidateToken, deviceToken: input.deviceToken };
        }
      }

      try {
        const { deviceToken } = await trustSessionDevice(admin, {
          sessionId,
          deviceFingerprint: input.deviceFingerprint,
        });
        return { sessionToken: candidateToken, deviceToken };
      } catch {
        return { error: "pin_required" };
      }
    }
    // Stale client token — fall through to active-session resolution.
  }

  const { data: tableRow } = await admin
    .from("tables")
    .select("id")
    .eq("qr_token", input.tableToken)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (!tableRow) {
    return { error: "invalid_qr" };
  }

  const active = await getActiveTableSession(
    admin,
    (tableRow as { id: string }).id
  );

  if (!active) {
    // No session on the table yet — order create pipeline opens one and
    // trusts this device (assert-access auto-open / approval path).
    return { deviceToken: input.deviceToken };
  }

  try {
    const { deviceToken } = await trustSessionDevice(admin, {
      sessionId: active.id,
      deviceFingerprint: input.deviceFingerprint,
    });
    return { sessionToken: active.session_token, deviceToken };
  } catch {
    return { error: "pin_required" };
  }
}

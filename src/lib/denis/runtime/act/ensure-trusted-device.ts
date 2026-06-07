import type { SupabaseClient } from "@supabase/supabase-js";
import { validateTableSession } from "@/lib/orders/validate-table-session";
import { isTrustedDevice, trustSessionDevice } from "@/lib/sessions/session-devices";

/** Trust party device for Denis ACL submit (server-side, no guest PIN sheet). */
export async function ensureTrustedDeviceForDenisSubmit(
  admin: SupabaseClient,
  input: {
    tableToken: string;
    sessionToken?: string;
    deviceFingerprint: string;
    deviceToken?: string;
  }
): Promise<{ deviceToken: string } | { error: string }> {
  if (!input.sessionToken?.trim()) {
    return { error: "missing_submit_context" };
  }

  const sessionResult = await validateTableSession(
    admin,
    input.tableToken,
    input.sessionToken
  );
  if ("error" in sessionResult) {
    return { error: sessionResult.error };
  }

  const sessionId = sessionResult.data.session.id;

  if (input.deviceToken) {
    const trusted = await isTrustedDevice(admin, {
      sessionId,
      deviceToken: input.deviceToken,
      deviceFingerprint: input.deviceFingerprint,
    });
    if (trusted) {
      return { deviceToken: input.deviceToken };
    }
  }

  try {
    const { deviceToken } = await trustSessionDevice(admin, {
      sessionId,
      deviceFingerprint: input.deviceFingerprint,
    });
    return { deviceToken };
  } catch {
    return { error: "pin_required" };
  }
}

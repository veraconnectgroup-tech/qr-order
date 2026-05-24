import {
  clearAiSessionId,
  readAiSessionId,
  writeAiSessionId,
} from "@/lib/ai/guest-session-storage";

/**
 * QR table token is always valid for AI (browse + seated).
 * Avoids "session expired" when a stale table session token is still in local storage.
 */
export function resolveGuestAiContextToken(
  qrToken: string,
  _tableSessionToken?: string | null
): string {
  return qrToken;
}

/** AI session ids are stored under the stable QR token for this table. */
export function readAiSessionIdForGuest(
  locationId: string,
  qrToken: string,
  legacyTokens: Array<string | null | undefined> = []
): string | null {
  const fromQr = readAiSessionId(locationId, qrToken);
  if (fromQr) return fromQr;

  for (const legacy of legacyTokens) {
    if (!legacy || legacy === qrToken) continue;
    const id = readAiSessionId(locationId, legacy);
    if (id) {
      writeAiSessionId(locationId, qrToken, id);
      clearAiSessionId(locationId, legacy);
      return id;
    }
  }

  return null;
}

export function writeAiSessionIdForGuest(
  locationId: string,
  qrToken: string,
  sessionId: string
) {
  writeAiSessionId(locationId, qrToken, sessionId);
}

export function clearAiSessionIdForGuest(
  locationId: string,
  qrToken: string,
  legacyTokens: Array<string | null | undefined> = []
) {
  clearAiSessionId(locationId, qrToken);
  for (const legacy of legacyTokens) {
    if (legacy && legacy !== qrToken) {
      clearAiSessionId(locationId, legacy);
    }
  }
}

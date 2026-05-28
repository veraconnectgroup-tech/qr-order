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

/**
 * Legacy table-session tokens may still hold an AI session id for the same table.
 * Never pass a token from another table — that copied chat history across QRs.
 */
export function legacyTokensForAiSession(
  tableId: string,
  sessionToken: string | null | undefined,
  guestTableId: string | null | undefined
): string[] {
  if (!sessionToken || sessionToken.trim().length === 0) return [];
  if (guestTableId && guestTableId !== tableId) return [];
  return [sessionToken];
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

/** Drop stale guest + AI state when the guest scans a different table QR. */
export function resetGuestStoresForTableSwitch(
  locationId: string,
  qrToken: string,
  tableId: string,
  legacyTokens: Array<string | null | undefined> = []
) {
  clearAiSessionIdForGuest(locationId, qrToken, legacyTokens);
  try {
    localStorage.setItem(`denis-bound-table-${locationId}`, tableId);
  } catch {
    // ignore
  }
}

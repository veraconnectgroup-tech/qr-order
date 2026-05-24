import {
  clearAiSessionId,
  readAiSessionId,
  writeAiSessionId,
} from "@/lib/ai/guest-session-storage";

/** Token sent to /api/ai/chat — table session when seated, otherwise QR browse token. */
export function resolveGuestAiContextToken(
  qrToken: string,
  tableSessionToken: string | null
): string {
  return tableSessionToken ?? qrToken;
}

/** Read stored AI session id, migrating from QR browse token to table session token. */
export function readAiSessionIdWithMigration(
  locationId: string,
  contextToken: string,
  qrToken: string
): string | null {
  const direct = readAiSessionId(locationId, contextToken);
  if (direct) return direct;

  if (contextToken === qrToken) return null;

  const fromQr = readAiSessionId(locationId, qrToken);
  if (!fromQr) return null;

  writeAiSessionId(locationId, contextToken, fromQr);
  clearAiSessionId(locationId, qrToken);
  return fromQr;
}

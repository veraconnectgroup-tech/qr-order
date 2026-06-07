import type { PartyMode } from "@/lib/denis/venue/party/types";

/** `table_sessions.session_token` lookup — not the QR aiContext token when both are sent. */
export function resolveGuestTableSessionLookupToken(input: {
  tableSessionToken?: string;
  sessionToken: string;
}): string {
  return input.tableSessionToken?.trim() || input.sessionToken;
}

/** Resolve which ai_session holds the shared draft (M12). */
export function resolveSharedAiSessionId(input: {
  partyMode: PartyMode;
  currentAiSessionId: string | null | undefined;
  sharedAiSessionId: string | null;
  primaryAiSessionId: string | null;
}): string | null {
  if (input.partyMode === "per_device") {
    return input.currentAiSessionId ?? null;
  }

  return (
    input.sharedAiSessionId ??
    input.primaryAiSessionId ??
    input.currentAiSessionId ??
    null
  );
}

export function resolveDraftAiSessionId(
  partyMode: PartyMode,
  currentAiSessionId: string | undefined,
  sharedAiSessionId: string | null
): string | undefined {
  if (partyMode === "per_device") return currentAiSessionId;
  return sharedAiSessionId ?? currentAiSessionId;
}

/** Shared-cart turns always read/write the table's denis_shared_ai_session_id. */
export function resolveCanonicalChatAiSessionId(
  partyMode: PartyMode,
  draftAiSessionId: string | undefined,
  clientSessionId: string | undefined
): string | undefined {
  if (partyMode === "shared_cart" && draftAiSessionId) {
    return draftAiSessionId;
  }
  return clientSessionId ?? draftAiSessionId;
}

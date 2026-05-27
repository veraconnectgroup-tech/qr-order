import type { PartyMode } from "@/lib/denis/venue/party/types";

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

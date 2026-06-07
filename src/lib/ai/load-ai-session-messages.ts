import { verifyAiGuestContext } from "@/lib/ai/verify-guest-context";
import { timelineToStoredMessages } from "@/lib/denis/loop/fold-transcript";
import { loadDenisTimeline } from "@/lib/denis/platform/append-timeline-event";
import { createAdminClient } from "@/lib/supabase/admin";

export type AiSessionHistoryMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

export type AiSessionHistory = {
  sessionId: string;
  messages: AiSessionHistoryMessage[];
  language: string;
  guestPreferences: { allergies: string[]; mood: string };
};

export async function loadAiSessionHistory(input: {
  sessionId: string;
  locationId: string;
  tableId: string;
  sessionToken: string;
}): Promise<
  { data: AiSessionHistory } | { error: string; status: number }
> {
  const admin = createAdminClient();

  const guestContext = await verifyAiGuestContext(admin, {
    locationId: input.locationId,
    tableId: input.tableId,
    sessionToken: input.sessionToken,
  });

  if ("error" in guestContext) {
    return { error: guestContext.error, status: guestContext.status };
  }

  const { data: row, error } = await admin
    .from("ai_sessions")
    .select("id, location_id, table_id, language, guest_preferences, status")
    .eq("id", input.sessionId)
    .maybeSingle();

  if (error) {
    return { error: "Could not load session.", status: 500 };
  }

  if (!row) {
    return { error: "Session not found.", status: 404 };
  }

  const session = row as {
    id: string;
    location_id: string;
    table_id: string;
    messages: unknown;
    language: string;
    guest_preferences: unknown;
    status: string;
  };

  if (
    session.location_id !== input.locationId ||
    session.table_id !== input.tableId
  ) {
    return { error: "Unauthorized.", status: 401 };
  }

  if (session.status !== "active") {
    return { error: "Session is no longer active.", status: 410 };
  }

  const timeline = await loadDenisTimeline(admin, session.id);
  const messages = timelineToStoredMessages(timeline);

  const prefs =
    session.guest_preferences &&
    typeof session.guest_preferences === "object" &&
    !Array.isArray(session.guest_preferences)
      ? (session.guest_preferences as { allergies?: unknown; mood?: unknown })
      : null;

  const allergies = Array.isArray(prefs?.allergies)
    ? prefs!.allergies.filter((item): item is string => typeof item === "string")
    : [];

  return {
    data: {
      sessionId: session.id,
      messages,
      language: session.language,
      guestPreferences: {
        allergies,
        mood: typeof prefs?.mood === "string" ? prefs.mood : "",
      },
    },
  };
}

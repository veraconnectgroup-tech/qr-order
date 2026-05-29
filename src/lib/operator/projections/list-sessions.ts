import type { SupabaseClient } from "@supabase/supabase-js";
import { countUserMessages } from "@/lib/operator/projections/helpers";
import type { OperatorSessionListItem } from "@/lib/operator/types";

export async function projectOperatorSessionList(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId?: string | null;
    from?: string | null;
    to?: string | null;
    converted?: boolean | null;
    limit?: number;
  }
): Promise<OperatorSessionListItem[]> {
  const limit = Math.min(input.limit ?? 100, 200);

  let locationIds: string[] = [];
  if (input.locationId) {
    const { data: location } = await admin
      .from("locations")
      .select("id")
      .eq("id", input.locationId)
      .eq("org_id", input.orgId)
      .maybeSingle();
    if (!location) return [];
    locationIds = [input.locationId];
  } else {
    const { data: locations } = await admin
      .from("locations")
      .select("id")
      .eq("org_id", input.orgId)
      .eq("is_active", true);
    locationIds = ((locations ?? []) as Array<{ id: string }>).map((row) => row.id);
  }

  if (!locationIds.length) return [];

  let query = admin
    .from("table_sessions")
    .select(
      "id, location_id, status, opened_at, closed_at, denis_shared_ai_session_id"
    )
    .in("location_id", locationIds)
    .order("opened_at", { ascending: false })
    .limit(limit);

  if (input.from) query = query.gte("opened_at", input.from);
  if (input.to) query = query.lte("opened_at", input.to);

  const { data: sessionRows } = await query;
  const sessions = (sessionRows ?? []) as Array<{
    id: string;
    location_id: string;
    status: string;
    opened_at: string;
    closed_at: string | null;
    denis_shared_ai_session_id: string | null;
  }>;

  if (!sessions.length) return [];

  const sessionIds = sessions.map((row) => row.id);
  const aiSessionIds = [
    ...new Set(
      sessions
        .map((row) => row.denis_shared_ai_session_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const orderSessionIds = new Set<string>();
  if (sessionIds.length) {
    const { data: orders } = await admin
      .from("orders")
      .select("session_id")
      .in("session_id", sessionIds)
      .neq("status", "cancelled");
    for (const row of (orders ?? []) as Array<{ session_id: string | null }>) {
      if (row.session_id) orderSessionIds.add(row.session_id);
    }
  }

  const aiById = new Map<
    string,
    { language: string; messages: Array<{ role: string; content: string }> }
  >();
  if (aiSessionIds.length) {
    const { data: aiRows } = await admin
      .from("ai_sessions")
      .select("id, language, messages")
      .eq("org_id", input.orgId)
      .in("id", aiSessionIds);
    for (const row of (aiRows ?? []) as Array<{
      id: string;
      language: string;
      messages: Array<{ role: string; content: string }>;
    }>) {
      aiById.set(row.id, { language: row.language, messages: row.messages ?? [] });
    }
  }

  const items: OperatorSessionListItem[] = sessions.map((session) => {
    const ai = session.denis_shared_ai_session_id
      ? aiById.get(session.denis_shared_ai_session_id)
      : undefined;
    const converted = orderSessionIds.has(session.id);
    return {
      id: session.id,
      locationId: session.location_id,
      status: session.status,
      openedAt: session.opened_at,
      closedAt: session.closed_at,
      messageCount: ai ? countUserMessages(ai.messages) : 0,
      language: ai?.language ?? null,
      converted,
    };
  });

  if (input.converted === true) {
    return items.filter((row) => row.converted);
  }
  if (input.converted === false) {
    return items.filter((row) => !row.converted);
  }

  return items;
}

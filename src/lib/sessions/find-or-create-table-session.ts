import { SESSION_MAX_AGE_HOURS } from "@/lib/constants";
import { dispatchOrgWebhook } from "@/lib/webhooks/dispatch";
import { orgIdForLocation } from "@/lib/webhooks/org-context";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

function isUniqueViolation(error: { code?: string; message?: string }) {
  return (
    error.code === "23505" ||
    /duplicate key/i.test(error.message ?? "")
  );
}

async function resolveActiveSession(
  admin: AdminClient,
  tableId: string,
  cutoff: string
) {
  const { data: existing } = await admin
    .from("table_sessions")
    .select("id, session_token")
    .eq("table_id", tableId)
    .eq("status", "active")
    .gte("opened_at", cutoff)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existing) return null;

  const row = existing as { id: string; session_token: string };
  return { sessionId: row.id, sessionToken: row.session_token };
}

async function dedupeActiveSessions(
  admin: AdminClient,
  tableId: string,
  locationId: string
) {
  const now = new Date().toISOString();
  const { data: allActive } = await admin
    .from("table_sessions")
    .select("id, session_token, opened_at")
    .eq("table_id", tableId)
    .eq("status", "active")
    .order("opened_at", { ascending: true });

  if (!allActive || allActive.length <= 1) {
    return null;
  }

  const rows = allActive as Array<{
    id: string;
    session_token: string;
    opened_at: string;
  }>;
  const oldest = rows[0];
  const duplicates = rows.slice(1);

  for (const dup of duplicates) {
    await admin
      .from("table_sessions")
      .update({ status: "closed", closed_at: now })
      .eq("id", dup.id);

    const orgId = await orgIdForLocation(locationId);
    if (orgId) {
      dispatchOrgWebhook(orgId, "session.closed", {
        session_id: dup.id,
        table_id: tableId,
      });
    }
  }

  return {
    sessionId: oldest.id,
    sessionToken: oldest.session_token,
  };
}

export async function findOrCreateTableSession(
  admin: AdminClient,
  tableId: string,
  locationId: string
): Promise<
  | { sessionId: string; sessionToken: string }
  | { error: string; status: number }
> {
  const maxAge = SESSION_MAX_AGE_HOURS * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - maxAge).toISOString();

  const existing = await resolveActiveSession(admin, tableId, cutoff);
  if (existing) return existing;

  await admin
    .from("table_sessions")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("table_id", tableId)
    .eq("status", "active");

  const { data: session, error } = await admin
    .from("table_sessions")
    .insert({
      table_id: tableId,
      location_id: locationId,
    })
    .select("id, session_token")
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      const raced = await resolveActiveSession(admin, tableId, cutoff);
      if (raced) return raced;
    }
    return { error: "Session could not be created.", status: 500 };
  }

  if (!session) {
    return { error: "Session could not be created.", status: 500 };
  }

  const deduped = await dedupeActiveSessions(admin, tableId, locationId);
  if (deduped) return deduped;

  const sessionRow = session as { id: string; session_token: string };

  const orgId = await orgIdForLocation(locationId);
  if (orgId) {
    dispatchOrgWebhook(orgId, "session.opened", {
      session_id: sessionRow.id,
      table_id: tableId,
      location_id: locationId,
    });
  }

  return {
    sessionId: sessionRow.id,
    sessionToken: sessionRow.session_token,
  };
}

import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export type SessionAccessState = "open" | "locked" | "closing" | "closed";

export async function transitionSessionAccess(
  admin: AdminClient,
  sessionId: string,
  accessState: SessionAccessState,
  meta?: {
    closedBy?: "qr" | "staff" | "pos" | "timeout" | "system";
  }
) {
  const update: Record<string, unknown> = { access_state: accessState };

  if (accessState === "closed" && meta?.closedBy) {
    update.closed_by = meta.closedBy;
  }

  await admin
    .from("table_sessions")
    .update(update as never)
    .eq("id", sessionId);
}

export async function lockTableSession(admin: AdminClient, sessionId: string) {
  await transitionSessionAccess(admin, sessionId, "locked");
}

export function isSessionOrderBlocked(accessState: string | null | undefined) {
  return accessState === "closing" || accessState === "closed";
}
